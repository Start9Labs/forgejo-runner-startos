import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

const shape = z
  .object({
    registrationToken: z.string().catch(''),
    runnerName: z.string().catch(''),
    // forgejo-runner label syntax: "<name>:docker://<image>" or "<name>:host".
    // Add foreign-arch labels here to also serve emulated jobs (slow — see README).
    labels: z
      .string()
      .catch('ubuntu-latest:docker://ghcr.io/catthehacker/ubuntu:act-22.04'),
    capacity: z.number().int().catch(1),
  })
  .strip()

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: './store.json' },
  shape,
)
