import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { mount } from '../utils'
import { storeJson } from '../fileModels/store.json'

const { InputSpec, Value } = sdk

const inputSpec = InputSpec.of({
  registrationToken: Value.text({
    name: i18n('Registration Token'),
    description: i18n(
      'A runner registration token from the Forgejo instance, under Site/Org/Repo Settings → Actions → Runners → Create new Runner.',
    ),
    required: true,
    default: null,
  }),
  runnerName: Value.text({
    name: i18n('Runner Name'),
    description: i18n('A name to identify this runner in the Forgejo UI.'),
    required: false,
    default: 'startos-runner',
  }),
  labels: Value.text({
    name: i18n('Labels'),
    description: i18n(
      'Comma-separated runner labels — syntax "name:docker://image" or "name:host". Adding a foreign-arch label also serves emulated jobs, which are much slower; prefer a native runner per architecture.',
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
})

export const configure = sdk.Action.withInput(
  'configure',

  async ({ effects }) => ({
    name: i18n('Configure'),
    description: i18n(
      'Register this runner with the Forgejo on this device. Saving re-registers on the next restart, so provide a fresh registration token each time.',
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
      registrationToken: s.registrationToken || undefined,
      runnerName: s.runnerName || null,
      labels: s.labels,
      capacity: s.capacity,
    }
  },

  async ({ effects, input }) => {
    await storeJson.merge(effects, {
      registrationToken: input.registrationToken ?? '',
      runnerName: input.runnerName ?? '',
      labels: input.labels ?? '',
      capacity: input.capacity,
    })

    // Drop the registration state so the runner re-registers with the new
    // settings (and the freshly supplied token) on the next start.
    await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'main' },
      mount,
      'reset-registration',
      async (sub) => {
        await sub.exec(['rm', '-f', '/data/runner/.runner'])
      },
    )

    return {
      version: '1',
      title: i18n('Saved'),
      message: i18n(
        'Runner configuration saved. Restart the service to (re)register with these settings.',
      ),
      result: null,
    }
  },
)
