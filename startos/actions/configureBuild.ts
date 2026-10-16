import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'
import { DEFAULT_BUILD_LABELS, runnerInput, validateRunners } from '../utils'

export const configureBuild = sdk.Action.withInput(
  'configure-build',

  async ({ effects }) => ({
    name: i18n('Configure Privileged Runner'),
    description: i18n(
      'Configure the optional privileged runner. Saving restarts both runners.',
    ),
    warning: i18n(
      'Use a separate registration scoped to trusted repositories or an organization, not a site-wide runner. Labels are not access control. Both runners share the outer StartOS service boundary.',
    ),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  sdk.InputSpec.of({
    enabled: sdk.Value.toggle({
      name: i18n('Enable Privileged Runner'),
      description: i18n(
        'Allow privileged jobs with access to this runner’s Docker engine. Disabled by default.',
      ),
      default: false,
    }),
    ...runnerInput(DEFAULT_BUILD_LABELS, false),
  }),

  async ({ effects }) => {
    const store = await storeJson.read().once()
    if (!store) return null
    return {
      ...store.buildRunner,
      runnerUuid: store.buildRunner.runnerUuid || undefined,
      runnerToken: store.buildRunner.runnerToken || undefined,
    }
  },

  async ({ effects, input }) => {
    const store = await storeJson.read().once()
    if (!store) throw new Error(i18n('Store not found'))
    const buildRunner = {
      ...input,
      runnerUuid: input.runnerUuid ?? '',
      runnerToken: input.runnerToken ?? '',
    }
    validateRunners({ ...store, buildRunner })
    await storeJson.merge(effects, { buildRunner })

    return {
      version: '1',
      title: i18n('Saved'),
      message: i18n('Runner configuration saved.'),
      result: null,
    }
  },
)
