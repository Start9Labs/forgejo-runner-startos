import { VersionGraph } from '@start9labs/start-sdk'
import { current } from './current'
import { v_13_2_0_5 } from './v13.2.0_5'

export const versionGraph = VersionGraph.of({
  current,
  other: [v_13_2_0_5],
})
