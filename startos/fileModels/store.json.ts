import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { DEFAULT_RUNNER_LABELS } from '../utils'

const incusShape = z.looseObject({
  // Empty uses the addresses carried by the enrollment token.
  url: z.string().catch(''),
  // SHA-256 of the pinned server certificate; empty until enrolled.
  fingerprint: z.string().catch(''),
  connectionId: z.string().catch(''),
  project: z.string().catch('default'),
  profile: z.string().catch('default'),
  storagePool: z.string().catch(''),
  network: z.string().catch(''),
  cpuCores: z.number().int().min(1).max(256).catch(2),
  memoryGiB: z.number().int().min(1).max(1024).catch(4),
  diskGiB: z.number().int().min(8).max(4096).catch(32),
})

export const incusDefaults = incusShape.parse({})

const shape = z.looseObject({
  // Forgejo v12 connection-model credentials: the runner UUID + token shown on
  // the "Create new Runner" screen. These are declared into config.yaml's
  // server.connections block by the entrypoint — `register` is deprecated.
  runnerUuid: z.string().catch(''),
  runnerToken: z.string().catch(''),
  // Empty selects the Forgejo on this server.
  remoteUrl: z.string().catch(''),
  labels: z.string().catch(DEFAULT_RUNNER_LABELS),
  capacity: z.number().int().min(1).max(64).catch(1),
  // When true, also advertise a foreign-arch label (pinned via `?platform=`)
  // so this runner serves emulated jobs for the other CPU architecture.
  emulation: z.boolean().catch(false),
  execution: z.enum(['vm', 'container', 'incus']).catch('vm'),
  incus: incusShape.catch(() => incusShape.parse({})),
})

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: './store.json' },
  shape,
)
