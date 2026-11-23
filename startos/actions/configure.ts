import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { incusDefaults, storeJson } from '../fileModels/store.json'
import {
  runnerInput,
  runnerLabels,
  runnerBackend,
  virtualizationAvailable,
  vmResources,
  vmDiskSize,
  remoteForgejoUrl,
  incusAddress,
  incusName,
  enrollIncus,
  INCUS_NAME_PATTERN,
} from '../utils'

const { Value, Variants, InputSpec } = sdk

const incusNamePattern = {
  regex: INCUS_NAME_PATTERN,
  description: i18n(
    'Must start with a letter or digit and contain only letters, digits, dots, dashes and underscores',
  ),
}

const incusSpec = InputSpec.of({
  url: Value.text({
    name: i18n('Incus Address'),
    description: i18n(
      'The Incus API address, such as https://incus.example.com:8443. Leave empty to use the addresses in the trust token. The port defaults to 8443.',
    ),
    required: false,
    default: null,
    inputmode: 'url',
  }),
  token: Value.text({
    name: i18n('Trust Token'),
    description: i18n(
      'Create one on the Incus server with "incus config trust add forgejo-runner". Needed the first time and to connect to a different server; leave empty to keep the current trust.',
    ),
    required: false,
    default: null,
    masked: true,
  }),
  project: Value.text({
    name: i18n('Project'),
    description: i18n('The Incus project that holds job VMs and images.'),
    required: true,
    default: incusDefaults.project,
    patterns: [incusNamePattern],
  }),
  profile: Value.text({
    name: i18n('Profile'),
    description: i18n(
      'The Incus profile applied to job VMs. It must provide a root disk and a network with outbound internet access.',
    ),
    required: true,
    default: incusDefaults.profile,
    patterns: [incusNamePattern],
  }),
  storagePool: Value.text({
    name: i18n('Storage Pool'),
    description: i18n(
      "Overrides the profile's storage pool for job VM disks. Leave empty to use the profile's.",
    ),
    required: false,
    default: null,
    patterns: [incusNamePattern],
  }),
  network: Value.text({
    name: i18n('Network'),
    description: i18n(
      "Overrides the profile's network for job VMs. Leave empty to use the profile's.",
    ),
    required: false,
    default: null,
    patterns: [incusNamePattern],
  }),
  cpuCores: Value.number({
    name: i18n('CPU Cores per Job'),
    required: true,
    default: incusDefaults.cpuCores,
    min: 1,
    max: 256,
    integer: true,
  }),
  memoryGiB: Value.number({
    name: i18n('Memory per Job'),
    required: true,
    default: incusDefaults.memoryGiB,
    min: 1,
    max: 1024,
    integer: true,
    units: 'GiB',
  }),
  diskGiB: Value.number({
    name: i18n('Disk per Job'),
    required: true,
    default: incusDefaults.diskGiB,
    min: 8,
    max: 4096,
    integer: true,
    units: 'GiB',
  }),
})

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
    return InputSpec.of({
      ...runnerInput(),
      execution: Value.dynamicUnion(async () => ({
        name: i18n('Execution'),
        description: i18n(
          'Where each job runs. Local VMs and Remote Incus boot a disposable VM with its own guest kernel per job; Local VMs need KVM on this server. Local containers start faster and use less memory, but share the StartOS kernel. Failures never switch modes.',
        ),
        default: available ? 'vm' : 'container',
        disabled: available ? false : ['vm'],
        variants: Variants.of({
          vm: { name: i18n('Local VMs'), spec: InputSpec.of({}) },
          container: {
            name: i18n('Local containers'),
            spec: InputSpec.of({}),
          },
          incus: { name: i18n('Remote Incus'), spec: incusSpec },
        }),
      })),
    })
  },
  async ({ effects }) => {
    const store = await storeJson.read().once()
    if (!store) return null
    const { fingerprint, connectionId, ...incus } = store.incus
    const execution =
      store.execution === 'vm' && !(await virtualizationAvailable(effects))
        ? 'container'
        : store.execution
    return {
      forgejo: store.remoteUrl
        ? { selection: 'remote' as const, value: { url: store.remoteUrl } }
        : { selection: 'local' as const, value: {} },
      runnerUuid: store.runnerUuid || undefined,
      runnerToken: store.runnerToken || undefined,
      labels: store.labels,
      capacity: store.capacity,
      emulation: store.emulation,
      execution:
        execution === 'incus'
          ? {
              selection: 'incus' as const,
              value: {
                ...incus,
                url: incus.url || null,
                storagePool: incus.storagePool || null,
                network: incus.network || null,
              },
            }
          : { selection: execution, value: {} },
    }
  },
  async ({ effects, input: { forgejo, execution, ...input } }) => {
    const backend = runnerBackend(
      execution.selection,
      await virtualizationAvailable(effects),
    )
    let incus = {}
    if (execution.selection === 'incus') {
      const { token, ...settings } = execution.value
      const names = [
        settings.project,
        settings.profile,
        settings.storagePool ?? '',
        settings.network ?? '',
      ]
      if (!names.every(incusName)) {
        throw new Error(incusNamePattern.description)
      }
      const url = incusAddress(settings.url ?? '')
      const connectionId = await storeJson
        .read((store) => store.incus.connectionId)
        .once()
      const { architecture, ...connection } = await enrollIncus(effects, {
        url,
        token: token?.trim() ?? '',
        project: settings.project,
        connectionId: connectionId ?? '',
      })
      runnerLabels(input, architecture)
      incus = {
        ...settings,
        ...connection,
        url,
        storagePool: settings.storagePool ?? '',
        network: settings.network ?? '',
      }
    } else {
      runnerLabels(input)
    }
    if (backend === 'vm') {
      vmResources(input.capacity)
      await vmDiskSize(effects, input.capacity)
    }
    await storeJson.merge(effects, {
      ...input,
      execution: backend,
      incus,
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
