import { cpus, totalmem } from 'os'
import { i18n } from './i18n'
import { sdk } from './sdk'
import { storeJson } from './fileModels/store.json'
import {
  DATA_DIR,
  LOCAL_FORGE_URL,
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

  // Local-only: the runner always registers against the Forgejo on this device.
  const configured = !!store.registrationToken

  const subcontainer = await sdk.SubContainer.of(
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
          INSTANCE_URL: LOCAL_FORGE_URL,
          RUNNER_TOKEN: store.registrationToken,
          RUNNER_NAME: store.runnerName || 'startos-runner',
          RUNNER_LABELS: store.labels,
          XDG_RUNTIME_DIR: `${DATA_DIR}/runner/run`,
        },
      },
      ready: {
        display: i18n('Runner'),
        gracePeriod: 60000,
        // Poll slowly: an unconfigured runner is a steady state, not a flapping
        // one, so there's no need to re-check (and log) every second.
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
