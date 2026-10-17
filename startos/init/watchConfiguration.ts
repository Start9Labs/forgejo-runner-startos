import { configure } from '../actions/configure'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  runnerLabels,
  virtualizationAvailable,
  vmResources,
  vmDiskSize,
} from '../utils'

export const watchConfiguration = sdk.setupOnInit(async (effects) => {
  const store = await storeJson.read().const(effects)
  if (!store?.runnerUuid || !store.runnerToken) {
    await sdk.action.createOwnTask(effects, configure, 'critical', {
      reason: i18n(
        'Run the Configure action to connect this runner to a Forgejo instance',
      ),
    })
    return
  }
  try {
    runnerLabels(store)
    if (store.virtualization && (await virtualizationAvailable(effects))) {
      vmResources(store.capacity)
      await vmDiskSize(effects, store.capacity)
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error
    await sdk.action.createOwnTask(effects, configure, 'critical', {
      reason: error.message,
    })
  }
})
