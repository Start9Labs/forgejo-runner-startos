import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'
import {
  runnerInput,
  runnerLabels,
  runnerBackend,
  virtualizationAvailable,
  vmResources,
  vmDiskSize,
  remoteForgejoUrl,
} from '../utils'

export const configure = sdk.Action.withInput(
  'configure',
  async () => ({
    name: i18n('Configure'),
    description: i18n(
      'Use one persistent Forgejo runner registration. Ephemeral registrations are not supported.',
    ),
    warning: i18n('Saving stops active jobs and restarts the runner.'),
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),
  async ({ effects }) => {
    const available = await virtualizationAvailable(effects)
    return sdk.InputSpec.of({
      ...runnerInput(),
      virtualization: sdk.Value.dynamicToggle(async () => ({
        name: i18n('Virtualization'),
        description: i18n(
          'Run each job in a disposable VM with its own guest kernel. Container mode starts faster and uses less memory, but shares the StartOS kernel. VM failures do not switch to container mode.',
        ),
        default: available,
        disabled: available
          ? false
          : i18n(
              'KVM is unavailable. Save with Virtualization off to explicitly use containers that share the StartOS kernel.',
            ),
      })),
    })
  },
  async ({ effects }) => {
    const store = await storeJson.read().once()
    if (!store) return null
    return {
      forgejo: store.remoteUrl
        ? { selection: 'remote' as const, value: { url: store.remoteUrl } }
        : { selection: 'local' as const, value: {} },
      runnerUuid: store.runnerUuid || undefined,
      runnerToken: store.runnerToken || undefined,
      labels: store.labels,
      capacity: store.capacity,
      emulation: store.emulation,
      virtualization:
        (await virtualizationAvailable(effects)) && store.virtualization,
    }
  },
  async ({ effects, input: { forgejo, ...input } }) => {
    runnerLabels(input)
    if (
      runnerBackend(
        input.virtualization,
        await virtualizationAvailable(effects),
      ) === 'vm'
    ) {
      vmResources(input.capacity)
      await vmDiskSize(effects, input.capacity)
    }
    await storeJson.merge(effects, {
      ...input,
      remoteUrl:
        forgejo.selection === 'remote'
          ? remoteForgejoUrl(forgejo.value.url)
          : '',
    })
    return {
      version: '1',
      title: i18n('Saved'),
      message: i18n('Runner configuration saved.'),
      result: null,
    }
  },
)
