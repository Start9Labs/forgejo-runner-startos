import { arch, cpus, totalmem } from 'os'
import { isIP } from 'net'

export const BINFMT_IMAGE =
  'tonistiigi/binfmt@sha256:400a4873b838d1b89194d982c45e5fb3cda4593fbfd7e08a02e76b03b21166f0'
export const VM_PREPARATION_STATUS = '/vm/preparation.status'
export const VM_PREPARATION_PROBE = `read -r pid phase < ${VM_PREPARATION_STATUS}; case "$phase" in ready|failed) ;; loading) kill -0 "$pid"; grep -qF /usr/local/bin/prepare-vm.sh /proc/$pid/cmdline;; *) exit 1;; esac; printf '%s' "$phase"`
export const VM_POOL_PROBE =
  'pid=$(cat /pool/manager.pid); kill -0 "$pid"; grep -qF /usr/local/bin/vm-pool.py /proc/$pid/cmdline; python3 -B /usr/local/bin/vm-pool.py status'

/** Preparation remains loading until its completion marker is published. */
export function vmPreparationState(exitCode: number | null, phase: string) {
  return exitCode !== 0 || phase === 'failed'
    ? ({
        result: 'failure',
        message: 'Guest VM image preparation failed',
      } as const)
    : phase === 'ready'
      ? ({ result: 'success', message: 'Guest VM image is prepared' } as const)
      : ({
          result: 'loading',
          message: 'Downloading and installing the guest VM image',
        } as const)
}

/** Reports the broker independently of worker readiness. */
export function vmPoolState(exitCode: number | null) {
  return exitCode === 0
    ? ({
        result: 'success',
        message: 'Shared guest-memory controller is running',
      } as const)
    : ({
        result: 'failure',
        message: 'Guest-memory controller is not running',
      } as const)
}

export const EMULATION_IMAGE = 'ghcr.io/catthehacker/ubuntu:act-22.04'
export const DEFAULT_RUNNER_LABELS = `ubuntu-latest:docker://${EMULATION_IMAGE}`
export const ROOT_CA_PATH =
  '/usr/local/share/ca-certificates/startos-root-ca.crt'
export const KVM_PROBE = 'test -c /dev/kvm && exec 3<>/dev/kvm'

/** Requires an explicit container choice when KVM is unavailable. */
export function resolveRunnerBackend(
  virtualization: boolean,
  available: boolean,
) {
  if (!virtualization) return { backend: 'container' } as const
  if (!available) {
    return {
      error:
        'Virtualization is enabled but KVM is unavailable. Restore KVM access and restart the service, or run Configure to explicitly select container mode.',
    } as const
  }
  return { backend: 'vm' } as const
}

/** Consumes sdk.getRootCa output, never a private-key bundle. */
export async function installRootCa(
  subcontainer: {
    writeFile(
      path: string,
      value: string,
      options: { mode: number },
    ): Promise<unknown>
    execFail(command: string[], options: { user: string }): Promise<unknown>
  },
  rootCa: string,
) {
  await subcontainer.writeFile(ROOT_CA_PATH, rootCa, { mode: 0o644 })
  await subcontainer.execFail(['update-ca-certificates'], { user: 'root' })
}

/** Replaces this runtime's host aliases without changing system entries. */
export async function installLocalHosts(
  subcontainer: {
    execFail(command: string[], options: { user: string }): Promise<unknown>
  },
  hosts: string[],
) {
  const marker = ' # ci-runner-local-host'
  const entries = [...new Set(hosts)].map((host) => {
    const match = /^([A-Za-z0-9][A-Za-z0-9.-]*):(.+)$/.exec(host)
    if (!match || isIP(match[2]) !== 4) {
      throw new Error('Invalid local host mapping')
    }
    return `${match[2]} ${match[1]}${marker}`
  })
  await subcontainer.execFail(
    [
      'python3',
      '-c',
      'import pathlib,sys; p=pathlib.Path("/etc/hosts"); lines=[line for line in p.read_text().splitlines() if not line.endswith(sys.argv[2])]; p.write_text("\\n".join(lines+sys.argv[1].splitlines())+"\\n")',
      entries.join('\n'),
      marker,
    ],
    { user: 'root' },
  )
}

/** Observes the worker and active guest, including Docker client authentication. */
export function vmJobProbe(port: number, runnerBinary: string) {
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !/^[a-z0-9][a-z0-9-]*$/.test(runnerBinary)
  ) {
    throw new Error('Invalid VM job probe arguments')
  }
  return `controller=$(cat /vm/controller.pid); kill -0 "$controller"; grep -qF /usr/local/bin/vm-worker.sh /proc/$controller/cmdline; case "$(cat /vm/phase)" in idle) if grep -qx ${runnerBinary} /proc/[0-9]*/comm; then echo idle; else echo starting; fi;; budget|booting|recycling) echo starting;; ready) kill -0 "$(cat /vm/qemu.pid)"; grep -qx ${runnerBinary} /proc/[0-9]*/comm; curl -fsS --max-time 4 --cacert /data/tls/client/ca.pem --cert /data/tls/client/cert.pem --key /data/tls/client/key.pem https://127.0.0.1:${port}/_ping >/dev/null; echo ready;; *) exit 1;; esac`
}

/** Loading must not gate an already-running daemon. */
export function vmJobState(exitCode: number | null, phase: string) {
  return {
    result:
      exitCode !== 0
        ? 'failure'
        : phase === 'idle'
          ? 'success'
          : phase === 'starting'
            ? 'starting'
            : 'loading',
    message:
      exitCode !== 0
        ? 'Virtualized job slot is not running'
        : phase === 'idle'
          ? 'Ready for a job; no VM allocated'
          : phase === 'starting'
            ? 'Preparing a disposable VM'
            : 'Running a job',
  } as const
}

/** Guest RAM excludes hypervisor and service overhead. */
export function guestResources(
  capacity: number,
  memoryBytes = totalmem(),
  cpuCount = cpus().length,
) {
  const bootMemoryMiB = 512
  const blockMemoryMiB = 128
  const memoryMiB =
    Math.floor((memoryBytes * 0.5) / 1024 ** 2 / blockMemoryMiB) *
    blockMemoryMiB
  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    !Number.isFinite(memoryMiB) ||
    memoryMiB < capacity * bootMemoryMiB
  ) {
    return null
  }
  return {
    cpuCores: Math.max(1, Math.floor(cpuCount / capacity)),
    memoryMiB,
    bootMemoryMiB,
    blockMemoryMiB,
    memoryDeviceId: 'job-memory',
  }
}

/** Zero when the bounded disk budget cannot fit a bootable guest. */
export function guestDiskGiB(availableMiB: number, capacity: number) {
  if (
    !Number.isFinite(availableMiB) ||
    !Number.isInteger(capacity) ||
    capacity < 1
  )
    return 0
  const diskGiB = Math.min(
    32,
    Math.floor((availableMiB * 0.5) / capacity / 1024),
  )
  return Number.isFinite(diskGiB) && diskGiB >= 8 ? diskGiB : 0
}

/** Rejects host execution and ambiguous routing labels. */
export function resolveRunnerLabels(
  settings: { labels: string; emulation: boolean },
  architecture = arch(),
) {
  const labels = settings.labels
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
  if (
    !labels.length ||
    labels.some((label) => !/^[^\s:,]+:docker:\/\/\S+$/.test(label))
  ) {
    return {
      error:
        'Runner labels must use name:docker://image. Host labels are not allowed.',
    } as const
  }
  if (settings.emulation) {
    const foreignArch = architecture === 'arm64' ? 'amd64' : 'arm64'
    labels.push(
      `linux-${foreignArch}:docker://${EMULATION_IMAGE}?platform=linux/${foreignArch}`,
    )
  }
  const names = labels.map((label) => label.split(':', 1)[0].toLowerCase())
  if (new Set(names).size !== labels.length) {
    return { error: 'Runner labels must be unique.' } as const
  }
  return { labels } as const
}
