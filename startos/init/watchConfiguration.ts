import { configure } from '../actions/configure'
import { configureBuild } from '../actions/configureBuild'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { runnerLabels, validateRunners } from '../utils'

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
    runnerLabels(store, 'unprivileged')
  } catch (error) {
    if (!(error instanceof Error)) throw error
    await sdk.action.createOwnTask(effects, configure, 'critical', {
      reason: error.message,
    })
    return
  }

  if (store.buildRunner.enabled) {
    try {
      validateRunners(store)
    } catch (error) {
      if (!(error instanceof Error)) throw error
      await sdk.action.createOwnTask(effects, configureBuild, 'critical', {
        reason: error.message,
      })
    }
  }
})
