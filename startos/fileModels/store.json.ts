import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { DEFAULT_BUILD_LABELS, DEFAULT_RUNNER_LABELS } from '../utils'

const runnerSettings = z.looseObject({
  // Forgejo v12 connection-model credentials: the runner UUID + token shown on
  // the "Create new Runner" screen. These are declared into config.yaml's
  // server.connections block by the entrypoint — `register` is deprecated.
  runnerUuid: z.string().catch(''),
  runnerToken: z.string().catch(''),
  labels: z.string().catch(DEFAULT_RUNNER_LABELS),
  capacity: z.number().int().min(1).catch(1),
  // When true, also advertise a foreign-arch label (pinned via `?platform=`)
  // so this runner serves emulated jobs for the other CPU architecture.
  emulation: z.boolean().catch(false),
})

const buildRunner = runnerSettings.extend({
  enabled: z.boolean().catch(false),
  labels: z.string().catch(DEFAULT_BUILD_LABELS),
})

const shape = runnerSettings.extend({
  buildRunner: buildRunner.catch(() => buildRunner.parse({})),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: './store.json' },
  shape,
)
