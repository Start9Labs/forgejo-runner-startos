import {
  mainHostId as forgejoHostId,
  uiPort,
} from 'forgejo-startos/startos/utils'
import { sdk } from './sdk'
import { i18n } from './i18n'
import {
  DEFAULT_RUNNER_LABELS,
  KVM_PROBE,
  guestDiskGiB,
  guestResources,
  resolveRunnerLabels,
  resolveRunnerBackend,
} from '../runtime'

export {
  DEFAULT_RUNNER_LABELS,
  EMULATION_IMAGE,
  ROOT_CA_PATH,
  installRootCa,
  installLocalHosts,
} from '../runtime'

// Means a 4 GB device: StartOS reserves 1 GiB before reporting service RAM.
export const MIN_MEMORY_BYTES = 1.5 * 1024 ** 3
export const MIN_CPU_CORES = 2
export const DATA_DIR = '/data'
export const SCRATCH_DIR = '/scratch'
export const JOB_SCRATCH_DIR = `${SCRATCH_DIR}/jobs`
export const RUNTIME_DIR = `${SCRATCH_DIR}/run`
export const DOCKER_HOST = `unix://${RUNTIME_DIR}/docker.sock`
export const INCUS_DIR = '/incus'
export const INCUS_SUBPATH = './incus'
const INCUS_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/
export type Execution = 'vm' | 'container' | 'incus'
export type RunnerSettings = {
  labels: string
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

export function remoteForgejoUrl(url: string) {
  return url.trim().replace(/\/+$/, '')
}

// Local hosts map Forgejo's mDNS names to the OS bridge in job containers.
export async function forgejoConnection(
  effects: Parameters<typeof sdk.SubContainer.of>[0],
  remoteUrl: string,
) {
  if (remoteUrl) return { url: remoteUrl, localHosts: [] as string[] }
  const bridge = await sdk.host
    .getBridgeAddress(effects, {
      packageId: 'forgejo',
      hostId: forgejoHostId,
      internalPort: uiPort,
      ssl: false,
    })
    .const()
  if (!bridge)
    throw new Error(
      i18n(
        'Forgejo is not yet reachable on the internal network. The runner will connect once its Forgejo dependency is running.',
      ),
    )
  const osIp = await sdk.getOsIp(effects)
  const localHosts = await sdk.host
    .get(effects, { packageId: 'forgejo', hostId: forgejoHostId }, (host) =>
      [
        ...new Set(
          Object.values(host?.bindings[uiPort]?.interfaces ?? {})
            .flatMap((iface) =>
              iface.addressInfo
                .filter({ kind: 'mdns' })
                .format('hostname-info'),
            )
            .map((address) => `${address.hostname}:${osIp}`),
        ),
      ].sort(),
    )
    .const()
  return { url: `http://${bridge}`, localHosts }
}

export function runnerBackend(execution: Execution, available: boolean) {
  if (execution === 'incus') return execution
  if (resolveRunnerBackend(execution === 'vm', available).error) {
    throw new Error(
      i18n(
        'Local VMs are selected, but KVM is unavailable. Restore KVM access, or run Configure to select another execution mode.',
      ),
    )
  }
  return execution
}

// Accepts host, host:port or an https URL; the Incus API port defaults to 8443.
export function incusAddress(address: string) {
  const trimmed = address.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  const url = new URL(
    /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
  )
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search) {
    throw new Error(i18n('The Incus address must be an https:// address'))
  }
  return `https://${url.hostname}:${url.port || '8443'}`
}

export function incusName(value: string) {
  return !value || INCUS_NAME.test(value)
}

function incusSubcontainer<T>(
  effects: Parameters<typeof sdk.SubContainer.of>[0],
  readonly: boolean,
  name: string,
  fn: (
    subcontainer: Parameters<
      Parameters<typeof sdk.SubContainer.withTemp>[4]
    >[0],
  ) => Promise<T>,
) {
  return sdk.SubContainer.withTemp(
    effects,
    { imageId: 'main' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'main',
      subpath: INCUS_SUBPATH,
      mountpoint: INCUS_DIR,
      readonly,
    }),
    name,
    fn,
  )
}

/**
 * Trusts this runner's client certificate on the Incus server and returns the
 * pinned server certificate's SHA-256 fingerprint. Without a token, keeps the
 * existing trust and only repoints its address.
 */
export async function enrollIncus(
  effects: Parameters<typeof sdk.SubContainer.of>[0],
  settings: { url: string; token: string; project: string },
) {
  const result = await incusSubcontainer(
    effects,
    false,
    'incus-enrollment',
    async (subcontainer) => {
      await subcontainer.execFail(['mkdir', '-p', INCUS_DIR], { user: 'root' })
      return subcontainer.exec(
        [
          'bash',
          '-ec',
          `export INCUS_CONF=${INCUS_DIR}
if [ -n "$TOKEN" ]; then
  if [ -n "$URL" ]; then
    TOKEN=$(printf '%s' "$TOKEN" | base64 -d | jq -c --arg address "\${URL#https://}" '.addresses = [$address]' | base64 -w0)
  fi
  incus remote remove pending >/dev/null 2>&1 || true
  incus remote add pending "$TOKEN" --project "$PROJECT" </dev/null
  incus remote remove runner >/dev/null 2>&1 || true
  incus remote rename pending runner
elif ! test -s ${INCUS_DIR}/servercerts/runner.crt; then
  echo 'NOT_ENROLLED'; exit 3
elif [ -n "$URL" ]; then
  incus remote set-url runner "$URL"
fi
incus query runner:/1.0 </dev/null | jq -e '.auth == "trusted"' >/dev/null
incus query "runner:/1.0/projects/$PROJECT" </dev/null >/dev/null
openssl x509 -in ${INCUS_DIR}/servercerts/runner.crt -noout -fingerprint -sha256 | cut -d= -f2`,
        ],
        {
          user: 'root',
          timeout: 120000,
          env: {
            TOKEN: settings.token,
            URL: settings.url,
            PROJECT: settings.project,
          },
        },
      )
    },
  )
  if (result.exitCode === 3) {
    throw new Error(
      i18n('Enter a trust token to connect this runner to the Incus server'),
    )
  }
  if (result.exitCode !== 0) {
    throw new Error(
      `${i18n('Could not connect to the Incus server')}: ${String(result.stderr).trim()}`,
    )
  }
  return String(result.stdout).trim()
}

/** Guest backend settings consumed by `runtime/assets/incus.sh`. */
export function incusEnv(settings: {
  project: string
  profile: string
  storagePool: string
  network: string
  cpuCores: number
  memoryGiB: number
  diskGiB: number
}) {
  return {
    VM_BACKEND: 'incus',
    INCUS_NAME_PREFIX: 'forgejo-runner',
    INCUS_PROJECT: settings.project,
    INCUS_PROFILE: settings.profile,
    INCUS_STORAGE_POOL: settings.storagePool,
    INCUS_NETWORK: settings.network,
    INCUS_CPU_CORES: String(settings.cpuCores),
    INCUS_MEMORY_GIB: String(settings.memoryGiB),
    INCUS_DISK_GIB: String(settings.diskGiB),
  }
}

/** The Incus server's CPU architecture, in Node's `os.arch()` naming. */
export async function incusArchitecture(
  effects: Parameters<typeof sdk.SubContainer.of>[0],
  project: string,
) {
  const result = await incusSubcontainer(
    effects,
    true,
    'incus-architecture',
    (subcontainer) =>
      subcontainer.exec(
        [
          'sh',
          '-ec',
          `INCUS_CONF=${INCUS_DIR} incus query runner:/1.0 </dev/null | jq -er .environment.kernel_architecture`,
        ],
        { user: 'root', timeout: 30000, env: { PROJECT: project } },
      ),
  )
  if (result.exitCode !== 0) {
    throw new Error(
      `${i18n('Could not connect to the Incus server')}: ${String(result.stderr).trim()}`,
    )
  }
  const kernel = String(result.stdout).trim()
  return kernel === 'aarch64' ? 'arm64' : kernel === 'x86_64' ? 'x64' : kernel
}

export async function virtualizationAvailable(
  effects: Parameters<typeof sdk.SubContainer.of>[0],
) {
  const result = await sdk.SubContainer.withTemp(
    effects,
    { imageId: 'main' },
    sdk.Mounts.of(),
    'virtualization-availability',
    (subcontainer) =>
      subcontainer.exec(['sh', '-ec', KVM_PROBE], {
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
  const diskGiB = guestDiskGiB(availableMiB, capacity)
  if (!diskGiB) {
    throw new Error(
      i18n(
        'Insufficient scratch space: each VM needs at least 8 GiB of disk space within the guest-disk budget.',
      ),
    )
  }
  return diskGiB
}

export function vmResources(capacity: number) {
  const resources = guestResources(capacity)
  if (!resources) {
    throw new Error(
      i18n(
        'Too many concurrent jobs: each VM needs at least 512 MiB of guest RAM.',
      ),
    )
  }
  return resources
}

export function runnerLabels(settings: RunnerSettings, architecture?: string) {
  const resolved = resolveRunnerLabels(settings, architecture)
  if (resolved.error) throw new Error(i18n(resolved.error))
  return resolved.labels
}

export function runnerInput() {
  const { Value, Variants, InputSpec } = sdk
  return {
    forgejo: Value.union({
      name: i18n('Forgejo Instance'),
      description: i18n(
        'The Forgejo this runner takes jobs from: the one installed on this server, or one running elsewhere.',
      ),
      default: 'local',
      variants: Variants.of({
        local: { name: i18n('This server'), spec: InputSpec.of({}) },
        remote: {
          name: i18n('Remote server'),
          spec: InputSpec.of({
            url: Value.text({
              name: i18n('Forgejo URL'),
              description: i18n(
                'The address of the remote Forgejo, as its users open it, for example https://forge.example.com. An HTTPS address needs a publicly trusted certificate, and the address must be reachable from this server and from job containers.',
              ),
              required: true,
              default: null,
              inputmode: 'url',
              patterns: [
                {
                  regex: '^https?://[^\\s"\'\\\\/?#]+(/[^\\s"\'\\\\?#]*)?$',
                  description: i18n(
                    'Must be an http:// or https:// address with no query or fragment',
                  ),
                },
              ],
            }),
          }),
        },
      }),
    }),
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
