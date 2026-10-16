import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'
import { RunnerTier } from '../utils'

// Written by the entrypoint when Forgejo answers `unregistered runner` for this UUID.
export const rejectedUuid = (tier: RunnerTier) =>
  FileHelper.string(
    { base: sdk.volumes.main, subpath: `./${tier}/runner/rejected-uuid` },
    z.string(),
  )
