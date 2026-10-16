import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { DEFAULT_RUNNER_LABELS } from '../utils'

const shape = z.looseObject({
  // Forgejo v12 connection-model credentials: the runner UUID + token shown on
  // the "Create new Runner" screen. These are declared into config.yaml's
  // server.connections block by the entrypoint — `register` is deprecated.
  runnerUuid: z.string().catch(''),
  runnerToken: z.string().catch(''),
  labels: z.string().catch(DEFAULT_RUNNER_LABELS),
  capacity: z.number().int().min(1).max(64).catch(1),
  // When true, also advertise a foreign-arch label (pinned via `?platform=`)
  // so this runner serves emulated jobs for the other CPU architecture.
  emulation: z.boolean().catch(false),
  virtualization: z.boolean().catch(true),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: './store.json' },
  shape,
)
