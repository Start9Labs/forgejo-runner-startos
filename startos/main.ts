import { arch, cpus, totalmem } from 'os'
import {
  mainHostId as forgejoHostId,
  uiPort,
} from 'forgejo-startos/startos/utils'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { storeJson } from './fileModels/store.json'
import {
  DATA_DIR,
  EMULATION_IMAGE,
  MIN_CPU_CORES,
  MIN_MEMORY_BYTES,
  mount,
} from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  // A CI runner runs full builds (compilers, image pulls, nested containers)
  // per job. Refuse to run on hardware that can't handle it.
  if (totalmem() < MIN_MEMORY_BYTES || cpus().length < MIN_CPU_CORES) {
    throw new Error(
      i18n(
        'This device does not meet the minimum requirements to run CI jobs (2 GiB RAM and 2 CPU cores).',
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

  // The connection is declared in config.yaml from these credentials, so having
  // both is the configured signal — `register` is gone, hence no `.runner`.
  const configured = !!(store.runnerUuid && store.runnerToken)

  // Emulation: also advertise a label for the other CPU architecture, pinned to
  // that platform via forgejo-runner's `?platform=` option so its jobs run under
  // StartOS's host QEMU binfmt. The runner process itself is always native.
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
      // The runner runs rootless as 'app' (uid 1000); give it ownership of its
      // working area on the persistent volume. StartOS's own store.json at
      // /data is left untouched.
      subcontainer,
      exec: {
        command: [
          'sh',
          '-c',
          `mkdir -p ${DATA_DIR}/runner && chown -R app:app ${DATA_DIR}/runner`,
        ],
        user: 'root',
      },
      requires: [],
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
          XDG_RUNTIME_DIR: `${DATA_DIR}/runner/run`,
        },
      },
      ready: {
        display: i18n('Runner'),
        gracePeriod: 60000,
        // Poll slowly — configuration state is steady, not flapping.
        trigger: sdk.trigger.cooldownTrigger(30000),
        fn: async () =>
          configured
            ? { result: 'success', message: i18n('Runner is configured') }
            : {
                result: 'failure',
                message: i18n(
                  'Run the Configure action to connect this runner to a Forgejo instance',
                ),
              },
      },
      requires: ['own-data'],
    })
})
