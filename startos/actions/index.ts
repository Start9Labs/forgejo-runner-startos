import { sdk } from '../sdk'
import { configure } from './configure'
import { configureBuild } from './configureBuild'

export const actions = sdk.Actions.of()
  .addAction(configure)
  .addAction(configureBuild)
