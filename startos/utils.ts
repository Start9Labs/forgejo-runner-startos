import { arch, cpus, totalmem } from 'os'
import { sdk } from './sdk'
import { i18n } from './i18n'

// Means a 4 GB device: StartOS reserves 1 GiB before reporting service RAM.
export const MIN_MEMORY_BYTES = 1.5 * 1024 ** 3
export const MIN_CPU_CORES = 2
export const EMULATION_IMAGE = 'ghcr.io/catthehacker/ubuntu:act-22.04'
export const DEFAULT_RUNNER_LABELS = `ubuntu-latest:docker://${EMULATION_IMAGE}`
export const DATA_DIR = '/data'
export const SCRATCH_DIR = '/scratch'
export const JOB_SCRATCH_DIR = `${SCRATCH_DIR}/jobs`
export const RUNTIME_DIR = `${SCRATCH_DIR}/run`
export const DOCKER_HOST = `unix://${RUNTIME_DIR}/docker.sock`
export const ROOT_CA_PATH =
  '/usr/local/share/ca-certificates/startos-root-ca.crt'

export async function installRootCa(
  subcontainer: ReturnType<typeof sdk.SubContainer.of>,
  rootCa: string,
) {
  await subcontainer.writeFile(ROOT_CA_PATH, rootCa, { mode: 0o644 })
  await subcontainer.execFail(['update-ca-certificates'], { user: 'root' })
}

export type RunnerSettings = {
  runnerUuid: string
  runnerToken: string
  labels: string
  capacity: number
  emulation: boolean
  virtualization: boolean
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

export async function virtualizationAvailable(
  effects: Parameters<typeof sdk.SubContainer.of>[0],
) {
  const result = await sdk.SubContainer.withTemp(
    effects,
    { imageId: 'main' },
    sdk.Mounts.of(),
    'virtualization-availability',
    (subcontainer) =>
      subcontainer.exec(['sh', '-ec', 'test -c /dev/kvm && exec 3<>/dev/kvm'], {
        user: 'root',
        timeout: 5000,
      }),
  )
  return result.exitCode === 0
}

export async function vmDiskSize(
  effects: Parameters<typeof sdk.SubContainer.of>[0],
  capacity: number,
) {
  const result = await sdk.SubContainer.withTemp(
    effects,
    { imageId: 'main' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'scratch',
      subpath: null,
      mountpoint: '/scratch',
      readonly: false,
    }),
    'vm-disk-budget',
    (subcontainer) =>
      subcontainer.execFail(['df', '-Pm', '/scratch'], {
        user: 'root',
        timeout: 5000,
      }),
  )
  const availableMiB = Number(
    String(result.stdout).trim().split('\n')[1]?.trim().split(/\s+/)[3],
  )
  const diskGiB = Math.min(
    32,
    Math.floor((availableMiB * 0.5) / capacity / 1024),
  )
  if (!Number.isFinite(diskGiB) || diskGiB < 8) {
    throw new Error(
      i18n(
        'Insufficient scratch space: each VM needs at least 8 GiB of disk space within the guest-disk budget.',
      ),
    )
  }
  return diskGiB
}

export function vmResources(capacity: number) {
  const bootMemoryMiB = 512
  const blockMemoryMiB = 128
  const memoryMiB =
    Math.floor((totalmem() * 0.5) / 1024 ** 2 / blockMemoryMiB) * blockMemoryMiB
  if (memoryMiB < capacity * bootMemoryMiB) {
    throw new Error(
      i18n(
        'Too many concurrent jobs: each VM needs at least 512 MiB of guest RAM.',
      ),
    )
  }
  return {
    cpuCores: Math.max(1, Math.floor(cpus().length / capacity)),
    memoryMiB,
    bootMemoryMiB,
    blockMemoryMiB,
    memoryDeviceId: 'job-memory',
  }
}

export function runnerLabels(settings: RunnerSettings) {
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
  if (settings.emulation) {
    const foreignArch = arch() === 'arm64' ? 'amd64' : 'arm64'
    labels.push(
      `linux-${foreignArch}:docker://${EMULATION_IMAGE}?platform=linux/${foreignArch}`,
    )
  }
  const names = labels.map((label) => label.split(':', 1)[0].toLowerCase())
  if (new Set(names).size !== labels.length) {
    throw new Error(i18n('Runner labels must be unique.'))
  }
  return labels
}

export function runnerInput() {
  const { Value } = sdk
  return {
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
        'Runner labels must use name:docker://image. Host labels are not allowed.',
      ),
      required: true,
      default: DEFAULT_RUNNER_LABELS,
    }),
    capacity: Value.number({
      name: i18n('Concurrent Jobs'),
      description: i18n(
        'Maximum concurrent assignments. Reusable-workflow jobs run sequentially within each assignment. VMs share one guest-memory pool; a job may wait for memory.',
      ),
      required: true,
      default: 1,
      min: 1,
      max: 64,
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
