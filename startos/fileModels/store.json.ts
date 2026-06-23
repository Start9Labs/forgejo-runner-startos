import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const shape = z
  .object({
    // Forgejo v12 connection-model credentials: the runner UUID + token shown on
    // the "Create new Runner" screen. These are declared into config.yaml's
    // server.connections block by the entrypoint — `register` is deprecated.
    runnerUuid: z.string().catch(''),
    runnerToken: z.string().catch(''),
    // forgejo-runner label syntax: "<name>:docker://<image>" or "<name>:host".
    labels: z
      .string()
      .catch('ubuntu-latest:docker://ghcr.io/catthehacker/ubuntu:act-22.04'),
    capacity: z.number().int().catch(1),
    // When true, also advertise a foreign-arch label (pinned via `?platform=`)
    // so this runner serves emulated jobs for the other CPU architecture.
    emulation: z.boolean().catch(false),
  })
  .strip()

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: './store.json' },
  shape,
)
