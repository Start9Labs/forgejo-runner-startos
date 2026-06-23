import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { storeJson } from '../fileModels/store.json'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  runnerUuid: Value.text({
    name: i18n('Runner UUID'),
    description: i18n(
      'The runner UUID shown by Forgejo when you create a runner, under Site/Org/Repo Settings → Actions → Runners → Create new Runner.',
    ),
    required: true,
    default: null,
  }),
  runnerToken: Value.text({
    name: i18n('Runner Token'),
    description: i18n(
      'The runner token shown alongside the UUID on the same Forgejo "Create new Runner" screen.',
    ),
    required: true,
    default: null,
    masked: true,
  }),
  labels: Value.text({
    name: i18n('Labels'),
    description: i18n(
      'Comma-separated runner labels — syntax "name:docker://image" or "name:host". For foreign-architecture jobs use the Enable Emulation toggle instead of adding arch labels by hand.',
    ),
    required: false,
    default: 'ubuntu-latest:docker://ghcr.io/catthehacker/ubuntu:act-22.04',
  }),
  capacity: Value.number({
    name: i18n('Concurrent Jobs'),
    description: i18n('How many jobs this runner executes at once.'),
    required: true,
    default: 1,
    min: 1,
    integer: true,
  }),
  emulation: Value.toggle({
    name: i18n('Enable Emulation'),
    description: i18n(
      'Also serve jobs for the other CPU architecture, run under emulation (much slower than native). Appends a foreign-architecture label pinned to that platform; prefer a native runner per architecture for regular builds.',
    ),
    default: false,
  }),
})

export const configure = sdk.Action.withInput(
  'configure',

  async ({ effects }) => ({
    name: i18n('Configure'),
    description: i18n(
      'Connect this runner to the Forgejo on this device. Saving applies on the next restart.',
    ),
    warning: null,
    allowedStatuses: 'any',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async ({ effects }) => {
    const s = await storeJson.read().const(effects)
    if (!s) return null
    return {
      runnerUuid: s.runnerUuid || undefined,
      runnerToken: s.runnerToken || undefined,
      labels: s.labels,
      capacity: s.capacity,
      emulation: s.emulation,
    }
  },

  async ({ effects, input }) => {
    await storeJson.merge(effects, {
      runnerUuid: input.runnerUuid ?? '',
      runnerToken: input.runnerToken ?? '',
      labels: input.labels ?? '',
      capacity: input.capacity,
      emulation: input.emulation,
    })

    return {
      version: '1',
      title: i18n('Saved'),
      message: i18n(
        'Runner configuration saved. Restart the service to apply.',
      ),
      result: null,
    }
  },
)
