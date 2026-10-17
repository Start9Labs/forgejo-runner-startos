import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

// Written by the entrypoint when Forgejo answers `unregistered runner` for this UUID.
export const rejectedUuid = (controllerPath: string) =>
  FileHelper.string(
    {
      base: sdk.volumes.main,
      subpath: `${controllerPath}/runner/rejected-uuid`,
    },
    z.string(),
  )
