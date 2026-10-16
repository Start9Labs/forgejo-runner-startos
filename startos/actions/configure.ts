import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'
import { DEFAULT_RUNNER_LABELS, runnerInput, validateRunners } from '../utils'

export const configure = sdk.Action.withInput(
  'configure',

  async ({ effects }) => ({
    name: i18n('Configure'),
    description: i18n(
      'Configure the unprivileged runner. Saving restarts both runners.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  sdk.InputSpec.of(runnerInput(DEFAULT_RUNNER_LABELS, true)),

  async ({ effects }) => {
    const store = await storeJson.read().once()
    if (!store) return null
    return {
      runnerUuid: store.runnerUuid || undefined,
      runnerToken: store.runnerToken || undefined,
      labels: store.labels,
      capacity: store.capacity,
      emulation: store.emulation,
    }
  },

  async ({ effects, input }) => {
    const store = await storeJson.read().once()
    if (!store) throw new Error(i18n('Store not found'))
    validateRunners({ ...store, ...input })
    await storeJson.merge(effects, input)

    return {
      version: '1',
      title: i18n('Saved'),
      message: i18n('Runner configuration saved.'),
      result: null,
    }
  },
)
