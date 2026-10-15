import { arch, cpus, totalmem } from 'os'
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
  EMULATION_IMAGE,
  JOB_SCRATCH_DIR,
  MIN_CPU_CORES,
  MIN_MEMORY_BYTES,
  RUNTIME_DIR,
  SCRATCH_DIR,
  mount,
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

  // Foreign-architecture labels require an explicit platform pin.
  const foreignArch = arch() === 'arm64' ? 'amd64' : 'arm64'
  const labels = [
    ...store.labels.split(',').map((l) => l.trim()),
    ...(store.emulation
      ? [
          `linux-${foreignArch}:docker://${EMULATION_IMAGE}?platform=linux/${foreignArch}`,
        ]
      : []),
  ]
    .filter(Boolean)
    .join(',')

  const subcontainer = sdk.SubContainer.of(
    effects,
    { imageId: 'main' },
    mount,
    'forgejo-runner-sub',
  )

  return sdk.Daemons.of(effects)
    .addOneshot('own-data', {
      // store.json shares the mount and must retain its ownership.
      subcontainer,
      exec: {
        command: [
          'sh',
          '-c',
          `mkdir -p ${DATA_DIR}/runner ${JOB_SCRATCH_DIR} && chown app:app ${DATA_DIR}/runner`,
        ],
        user: 'root',
      },
      requires: [],
    })
    .addOneshot('clean-runtime', {
      // Runtime sockets and PID files cannot survive a container restart.
      subcontainer,
      exec: {
        command: [
          'sh',
          '-c',
          `rm -rf ${RUNTIME_DIR} && install -d -o app -g app -m 0700 ${RUNTIME_DIR}`,
        ],
        user: 'root',
      },
      requires: ['own-data'],
    })
    .addDaemon('engine', {
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
        ],
        user: 'root',
        env: { BINFMT_DIR: `${RUNTIME_DIR}/binfmt` },
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
      requires: ['clean-runtime'],
    })
    .addDaemon('primary', {
      subcontainer,
      exec: {
        command: ['/usr/local/bin/entrypoint.sh'],
        user: 'app',
        env: {
          INSTANCE_URL: forgeUrl,
          RUNNER_UUID: store.runnerUuid,
          RUNNER_TOKEN: store.runnerToken,
          RUNNER_LABELS: labels,
          RUNNER_CAPACITY: String(store.capacity),
          DOCKER_HOST,
          RUNNER_SCRATCH_DIR: JOB_SCRATCH_DIR,
        },
      },
      ready: {
        display: i18n('Runner'),
        gracePeriod: 60000,
        trigger: sdk.trigger.cooldownTrigger(30000),
        fn: async () =>
          (await rejectedUuid.read().once())?.trim() === store.runnerUuid
            ? {
                result: 'failure',
                message: i18n(
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
      requires: ['engine'],
    })
})
