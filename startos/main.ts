import { cpus, totalmem } from 'os'
import {
  mainHostId as forgejoHostId,
  uiPort,
} from 'forgejo-startos/startos/utils'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { storeJson } from './fileModels/store.json'
import { rejectedUuid } from './fileModels/rejectedUuid'
import {
  DATA_DIR,
  DOCKER_HOST,
  JOB_SCRATCH_DIR,
  MIN_CPU_CORES,
  MIN_MEMORY_BYTES,
  RUNTIME_DIR,
  SCRATCH_DIR,
  RunnerSettings,
  RunnerTier,
  runnerLabels,
  runnerMounts,
  runnerTiers,
  validateRunners,
} from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  // A CI runner runs full builds (compilers, image pulls, nested containers)
  // per job. Refuse to run on hardware that can't handle it.
  if (totalmem() < MIN_MEMORY_BYTES || cpus().length < MIN_CPU_CORES) {
    throw new Error(
      i18n(
        'This device does not meet the minimum requirements to run CI jobs (4 GB of RAM and 2 CPU cores).',
      ),
    )
  }

  const store = await storeJson.read().const(effects)
  if (!store) throw new Error(i18n('Store not found'))
  validateRunners(store)

  // The runner connects to its Forgejo dependency over the internal LXC bridge.
  // `sdk.host.getBridgeAddress` resolves the address Forgejo's `http` binding
  // itself publishes on the bridge, so it holds steady across Forgejo
  // updates/restarts; `.const()` re-runs main only
  // when the address itself changes (Forgejo install/uninstall/port-change),
  // never on churn. A null (Forgejo absent) surfaces the friendly guard below.
  const forgeBridge = await sdk.host
    .getBridgeAddress(effects, {
      packageId: 'forgejo',
      hostId: forgejoHostId,
      internalPort: uiPort,
      ssl: false,
    })
    .const()
  if (!forgeBridge)
    throw new Error(
      i18n(
        'Forgejo is not yet reachable on the internal network. The runner will connect once its Forgejo dependency is running.',
      ),
    )
  const forgeUrl = `http://${forgeBridge}`

  function defineRunner(tier: RunnerTier, settings: RunnerSettings) {
    const profile = runnerTiers[tier]
    const subcontainer = sdk.SubContainer.of(
      effects,
      { imageId: 'main' },
      runnerMounts(tier),
      profile.subcontainerName,
    )
    const rejection = rejectedUuid(tier)
    const configureAction = profile.privileged
      ? i18n('Configure Build Runner')
      : i18n('Configure')
    return {
      ownData: {
        subcontainer,
        exec: {
          command: [
            'sh',
            '-c',
            `mkdir -p ${DATA_DIR}/runner${profile.privileged ? ` ${JOB_SCRATCH_DIR}` : ''} && chown app:app ${DATA_DIR}/runner`,
          ] satisfies [string, ...string[]],
          user: 'root',
        },
      },
      cleanRuntime: {
        // Runtime sockets and PID files cannot survive a container restart.
        subcontainer,
        exec: {
          command: [
            'sh',
            '-c',
            `rm -rf ${RUNTIME_DIR} && install -d -o app -g app -m 0700 ${RUNTIME_DIR}`,
          ] satisfies [string, ...string[]],
          user: 'root',
        },
      },
      engine: {
        subcontainer,
        exec: {
          command: [
            '/usr/local/bin/engine.sh',
            '--host',
            DOCKER_HOST,
            '--group',
            'app',
            '--data-root',
            `${SCRATCH_DIR}/docker`,
            '--exec-root',
            `${RUNTIME_DIR}/docker`,
            '--pidfile',
            `${RUNTIME_DIR}/docker.pid`,
            '--bridge',
            profile.bridge,
            '--default-address-pool',
            `base=${profile.addressPool},size=24`,
          ] satisfies [string, ...string[]],
          user: 'root',
          env: {
            BINFMT_DIR: `${RUNTIME_DIR}/binfmt`,
            RUNNER_BRIDGE: profile.bridge,
            RUNNER_BRIDGE_ADDRESS: profile.bridgeAddress,
          },
        },
        ready: {
          display: null,
          fn: () =>
            sdk.healthCheck.runHealthScript(
              ['docker', '--host', DOCKER_HOST, 'info'],
              subcontainer,
              { timeout: 10000 },
            ),
        },
      },
      runner: {
        subcontainer,
        exec: {
          command: ['/usr/local/bin/entrypoint.sh'] satisfies [
            string,
            ...string[],
          ],
          user: 'app',
          env: {
            INSTANCE_URL: forgeUrl,
            RUNNER_UUID: settings.runnerUuid,
            RUNNER_TOKEN: settings.runnerToken,
            RUNNER_LABELS: runnerLabels(settings, tier).join(','),
            RUNNER_CAPACITY: String(settings.capacity),
            RUNNER_PRIVILEGED: String(profile.privileged),
            RUNNER_CONFIGURE_ACTION: configureAction,
            DOCKER_HOST,
            RUNNER_SCRATCH_DIR: JOB_SCRATCH_DIR,
          },
        },
        ready: {
          display: i18n(profile.display),
          gracePeriod: 60000,
          trigger: sdk.trigger.cooldownTrigger(30000),
          fn: async () =>
            (await rejection.read().once())?.trim() === settings.runnerUuid
              ? {
                  result: 'failure' as const,
                  message: profile.privileged
                    ? i18n(
                        'Forgejo no longer recognizes the build runner. Create a new scoped registration and enter it in Configure Build Runner.',
                      )
                    : i18n(
                        'Forgejo no longer recognizes this runner. Create a new runner in Forgejo, enter its UUID and token in the Configure action, then restart this service.',
                      ),
                }
              : sdk.healthCheck.runHealthScript(
                  [
                    'bash',
                    '-c',
                    // `comm` is 15 characters wide, which `forgejo-runner` fits.
                    `grep -qx forgejo-runner /proc/[0-9]*/comm 2>/dev/null && docker --host ${DOCKER_HOST} info >/dev/null`,
                  ],
                  subcontainer,
                  {
                    timeout: 10000,
                    message: () => i18n('Runner is running'),
                    errorMessage: i18n('The runner is not running'),
                  },
                ),
        },
      },
    }
  }

  const regular = defineRunner('unprivileged', store)
  const build = store.buildRunner.enabled
    ? defineRunner('build', store.buildRunner)
    : null
  const engines = build
    ? (['engine', 'build-engine'] as const)
    : (['engine'] as const)

  return sdk.Daemons.of(effects)
    .addOneshot('own-data', { ...regular.ownData, requires: [] })
    .addOneshot('clean-runtime', {
      ...regular.cleanRuntime,
      requires: ['own-data'],
    })
    .addDaemon('engine', { ...regular.engine, requires: ['clean-runtime'] })
    .addOneshot('build-own-data', () =>
      build ? { ...build.ownData, requires: [] } : null,
    )
    .addOneshot('build-clean-runtime', () =>
      build
        ? {
            ...build.cleanRuntime,
            requires: ['build-own-data'],
          }
        : null,
    )
    .addDaemon('build-engine', () =>
      build
        ? {
            ...build.engine,
            requires: ['build-clean-runtime'],
          }
        : null,
    )
    .addDaemon('primary', { ...regular.runner, requires: [...engines] })
    .addDaemon('build-runner', () =>
      build ? { ...build.runner, requires: [...engines] } : null,
    )
})
