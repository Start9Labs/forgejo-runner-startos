import { arch } from 'os'
import { sdk } from './sdk'
import { i18n } from './i18n'

// ---- Resource gate ----
// A CI runner only makes sense on a box with real headroom: every job runs a
// full build (compilers, image pulls, nested containers). These are the floor
// below which we refuse to run; enforced in main.ts via node:os.
// Means "a 4 GB machine or better". os.totalmem() here is what StartOS grants
// service containers -- host MemTotal less its 1 GiB reserve -- so a 4 GB machine
// reports ~2.8 GiB and a 2 GB one ~0.8 GiB. 1.5 GiB sits between them.
export const MIN_MEMORY_BYTES = 1.5 * 1024 ** 3
export const MIN_CPU_CORES = 2
// ---- Emulation ----
// Image advertised by the "Enable Emulation" toggle, pinned to the foreign
// platform (via forgejo-runner's `?platform=` label option) so its jobs run
// under the service's namespace-local QEMU binfmt. The multi-arch catthehacker default.
export const EMULATION_IMAGE = 'ghcr.io/catthehacker/ubuntu:act-22.04'
export const DEFAULT_RUNNER_LABELS = `ubuntu-latest:docker://${EMULATION_IMAGE}`
export const DEFAULT_BUILD_LABELS = `startos-build:docker://${EMULATION_IMAGE}`
// ---- Paths (inside the service container) ----
export const DATA_DIR = '/data'
export const SCRATCH_DIR = '/scratch'
export const JOB_SCRATCH_DIR = `${SCRATCH_DIR}/jobs`
export const RUNTIME_DIR = `${DATA_DIR}/runner/run`
export const DOCKER_HOST = `unix://${RUNTIME_DIR}/docker.sock`

export const runnerTiers = {
  unprivileged: {
    subcontainerName: 'forgejo-runner-sub',
    display: 'Runner',
    foreignLabelPrefix: 'linux',
    privileged: false,
    bridge: 'runner-default',
    bridgeAddress: '172.18.0.1/24',
    addressPool: '172.20.0.0/16',
  },
  build: {
    subcontainerName: 'forgejo-build-runner-sub',
    display: 'Build Runner',
    foreignLabelPrefix: 'startos-build',
    privileged: true,
    bridge: 'runner-build',
    bridgeAddress: '172.19.0.1/24',
    addressPool: '172.21.0.0/16',
  },
} as const

export type RunnerTier = keyof typeof runnerTiers
export type RunnerSettings = {
  runnerUuid: string
  runnerToken: string
  labels: string
  capacity: number
  emulation: boolean
}

export const mount = sdk.Mounts.of()
  .mountVolume({
    volumeId: 'main',
    subpath: null,
    mountpoint: DATA_DIR,
    readonly: false,
  })
  .mountVolume({
    volumeId: 'scratch',
    subpath: null,
    mountpoint: SCRATCH_DIR,
    readonly: false,
  })

export function runnerMounts(tier: RunnerTier) {
  return sdk.Mounts.of()
    .mountVolume({
      volumeId: 'main',
      subpath: `./${tier}`,
      mountpoint: DATA_DIR,
      readonly: false,
    })
    .mountVolume({
      volumeId: 'scratch',
      subpath: `./${tier}`,
      mountpoint: SCRATCH_DIR,
      readonly: false,
    })
}

const labelName = (label: string) => label.split(':', 1)[0].toLowerCase()

export function runnerLabels(settings: RunnerSettings, tier: RunnerTier) {
  const labels = settings.labels
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
  if (
    !labels.length ||
    labels.some((label) => !/^[^\s:,]+:docker:\/\/\S+$/.test(label))
  ) {
    throw new Error(
      i18n(
        'Runner labels must use name:docker://image. Host labels are not allowed.',
      ),
    )
  }
  const foreignArch = arch() === 'arm64' ? 'amd64' : 'arm64'
  if (settings.emulation) {
    labels.push(
      `${runnerTiers[tier].foreignLabelPrefix}-${foreignArch}:docker://${EMULATION_IMAGE}?platform=linux/${foreignArch}`,
    )
  }
  if (new Set(labels.map(labelName)).size !== labels.length) {
    throw new Error(i18n('Labels must be unique within each runner.'))
  }
  return labels
}

export function validateRunners(
  store: RunnerSettings & {
    buildRunner: RunnerSettings & { enabled: boolean }
  },
) {
  const regularLabels = runnerLabels(store, 'unprivileged')
  if (!store.buildRunner.enabled) return
  const buildLabels = runnerLabels(store.buildRunner, 'build')
  if (!store.buildRunner.runnerUuid || !store.buildRunner.runnerToken) {
    throw new Error(
      i18n('Configure the Build Runner credentials before enabling it.'),
    )
  }
  if (store.runnerUuid === store.buildRunner.runnerUuid) {
    throw new Error(
      i18n('Use a different Forgejo runner registration for each runner.'),
    )
  }
  const regularNames = new Set(regularLabels.map(labelName))
  if (buildLabels.some((label) => regularNames.has(labelName(label)))) {
    throw new Error(i18n('The two runners must advertise different labels.'))
  }
}

export function runnerInput<Required extends boolean>(
  defaultLabels: string,
  credentialsRequired: Required,
) {
  const { Value } = sdk
  return {
    runnerUuid: Value.text({
      name: i18n('Runner UUID'),
      description: i18n(
        'The runner UUID shown by Forgejo when you create a runner, under Site/Org/Repo Settings → Actions → Runners → Create new Runner.',
      ),
      required: credentialsRequired,
      default: null,
    }),
    runnerToken: Value.text({
      name: i18n('Runner Token'),
      description: i18n(
        'The runner token shown alongside the UUID on the same Forgejo "Create new Runner" screen.',
      ),
      required: credentialsRequired,
      default: null,
      masked: true,
    }),
    labels: Value.text({
      name: i18n('Labels'),
      description: i18n(
        'Runner labels must use name:docker://image. Host labels are not allowed.',
      ),
      required: true,
      default: defaultLabels,
    }),
    capacity: Value.number({
      name: i18n('Concurrent Jobs'),
      description: i18n(
        "How many jobs run at the same time. Each job is a full build in its own container, and all of them share this device's CPU and memory.",
      ),
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
  }
}
