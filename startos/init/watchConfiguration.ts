import { configure } from '../actions/configure'
import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import {
  runnerLabels,
  runnerBackend,
  virtualizationAvailable,
  vmResources,
  vmDiskSize,
  incusArchitecture,
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
  const architecture =
    store.execution === 'incus' &&
    store.incus.fingerprint &&
    store.incus.connectionId
      ? await incusArchitecture(effects, store.incus.connectionId).catch(
          () => null,
        )
      : undefined
  try {
    const backend = runnerBackend(
      store.execution,
      await virtualizationAvailable(effects),
    )
    if (backend === 'vm') {
      vmResources(store.capacity)
      await vmDiskSize(effects, store.capacity)
    }
    if (
      backend === 'incus' &&
      (!store.incus.fingerprint || !store.incus.connectionId)
    ) {
      throw new Error(
        i18n('Enter a trust token to connect this runner to the Incus server'),
      )
    }
    // An unreachable Incus server skips this check; main validates labels at start.
    if (architecture !== null) runnerLabels(store, architecture)
  } catch (error) {
    if (!(error instanceof Error)) throw error
    await sdk.action.createOwnTask(effects, configure, 'critical', {
      reason: error.message,
    })
    return
  }
  await sdk.action.clearTask(effects, `${sdk.manifest.id}:${configure.id}`)
})
