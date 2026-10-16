import { cpus, totalmem } from 'os'
import {
  mainHostId as forgejoHostId,
  uiPort,
} from 'forgejo-startos/startos/utils'
import { sdk } from './sdk'
import { i18n } from './i18n'
import { storeJson } from './fileModels/store.json'
import { rejectedUuid } from './fileModels/rejectedUuid'
import {
  DOCKER_HOST,
  JOB_SCRATCH_DIR,
  MIN_CPU_CORES,
  MIN_MEMORY_BYTES,
  RUNTIME_DIR,
  runnerLabels,
  virtualizationAvailable,
  vmResources,
  vmDiskSize,
} from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  if (totalmem() < MIN_MEMORY_BYTES || cpus().length < MIN_CPU_CORES) {
    throw new Error(
      i18n(
        'This device does not meet the minimum requirements to run CI jobs (4 GB of RAM and 2 CPU cores).',
      ),
    )
  }
  const store = await storeJson.read().const(effects)
  if (!store) throw new Error(i18n('Store not found'))
  const forgeBridge = await sdk.host
    .getBridgeAddress(effects, {
      packageId: 'forgejo',
      hostId: forgejoHostId,
      internalPort: uiPort,
      ssl: false,
    })
    .const()
  if (!forgeBridge)
    throw new Error(
      i18n(
        'Forgejo is not yet reachable on the internal network. The runner will connect once its Forgejo dependency is running.',
      ),
    )
  const available = await virtualizationAvailable(effects)
  const env = {
    INSTANCE_URL: `http://${forgeBridge}`,
    RUNNER_UUID: store.runnerUuid,
    RUNNER_TOKEN: store.runnerToken,
    RUNNER_LABELS: runnerLabels(store).join(','),
    RUNNER_PRIVILEGED: 'true',
    RUNNER_CONFIGURE_ACTION: i18n('Configure'),
  }
  if (!store.virtualization || !available) {
    const controllerPath = './controller/container'
    const engine = sdk.SubContainer.of(
      effects,
      { imageId: 'main' },
      sdk.Mounts.of().mountVolume({
        volumeId: 'scratch',
        subpath: './container',
        mountpoint: '/scratch',
        readonly: false,
      }),
      'container-engine',
    )
    const controller = sdk.SubContainer.of(
      effects,
      { imageId: 'main' },
      sdk.Mounts.of()
        .mountVolume({
          volumeId: 'main',
          subpath: controllerPath,
          mountpoint: '/data',
          readonly: false,
        })
        .mountVolume({
          volumeId: 'scratch',
          subpath: './container',
          mountpoint: '/scratch',
          readonly: false,
        }),
      'runner-controller',
    )
    const rejection = rejectedUuid(controllerPath)
    return sdk.Daemons.of(effects)
      .addOneshot('prepare-controller', {
        subcontainer: controller,
        exec: {
          command: ['mkdir', '-p', '/data/runner/run', JOB_SCRATCH_DIR],
          user: 'root',
        },
        requires: [],
      })
      .addOneshot('prepare-engine', {
        subcontainer: engine,
        exec: {
          command: [
            'sh',
            '-ec',
            `rm -rf ${RUNTIME_DIR}; mkdir -p ${RUNTIME_DIR}`,
          ],
          user: 'root',
        },
        requires: [],
      })
      .addDaemon('engine', {
        subcontainer: engine,
        exec: {
          command: [
            '/usr/local/bin/engine.sh',
            '--host',
            DOCKER_HOST,
            '--group',
            'app',
            '--data-root',
            '/scratch/docker',
            '--exec-root',
            `${RUNTIME_DIR}/docker`,
            '--pidfile',
            `${RUNTIME_DIR}/docker.pid`,
            '--bridge',
            'runner',
            '--default-address-pool',
            'base=172.20.0.0/16,size=24',
          ],
          user: 'root',
          env: {
            BINFMT_DIR: `${RUNTIME_DIR}/binfmt`,
            RUNNER_BRIDGE: 'runner',
            RUNNER_BRIDGE_ADDRESS: '172.18.0.1/24',
          },
        },
        ready: {
          display: null,
          fn: () =>
            sdk.healthCheck.runHealthScript(
              ['docker', '--host', DOCKER_HOST, 'info'],
              engine,
              { timeout: 10000 },
            ),
        },
        requires: ['prepare-engine'],
      })
      .addDaemon('runner', {
        subcontainer: controller,
        exec: {
          command: ['/usr/local/bin/entrypoint.sh'],
          user: 'root',
          env: {
            ...env,
            DOCKER_HOST,
            RUNNER_CAPACITY: String(store.capacity),
            RUNNER_SCRATCH_DIR: JOB_SCRATCH_DIR,
          },
        },
        ready: {
          display: i18n('Runner'),
          fn: async () =>
            (await rejection.read().once())?.trim() === store.runnerUuid
              ? {
                  result: 'failure' as const,
                  message: i18n(
                    'Forgejo no longer recognizes this runner. Create a new runner in Forgejo, enter its UUID and token in the Configure action, then restart this service.',
                  ),
                }
              : sdk.healthCheck.runHealthScript(
                  [
                    'sh',
                    '-ec',
                    `grep -qx forgejo-runner /proc/[0-9]*/comm && docker --host ${DOCKER_HOST} info >/dev/null`,
                  ],
                  controller,
                  {
                    timeout: 10000,
                    message: () => i18n('Runner is running'),
                    errorMessage: i18n('The runner is not running'),
                  },
                ),
        },
        requires: ['prepare-controller', 'engine'],
      })
      .addHealthCheck('execution-mode', {
        ready: {
          display: i18n('Container Mode'),
          fn: async () => ({
            result: 'success',
            message: available
              ? i18n(
                  'Virtualization is disabled. Jobs use privileged containers within the service and share the StartOS kernel. Only run trusted workflows.',
                )
              : i18n(
                  'KVM is unavailable. Jobs use containers and share the StartOS kernel.',
                ),
          }),
        },
        requires: [],
      })
  }

  const resources = vmResources(store.capacity)
  const diskGiB = await vmDiskSize(effects, store.capacity)
  const preparationResources = vmResources(1)
  const preparer = sdk.SubContainer.of(
    effects,
    { imageId: 'main' },
    sdk.Mounts.of()
      .mountVolume({
        volumeId: 'scratch',
        subpath: './vm-images',
        mountpoint: '/cache',
        readonly: false,
      })
      .mountVolume({
        volumeId: 'scratch',
        subpath: './vm-preparation/runtime',
        mountpoint: '/vm',
        readonly: false,
      })
      .mountVolume({
        volumeId: 'scratch',
        subpath: './vm-preparation/control',
        mountpoint: '/data',
        readonly: false,
      }),
    'vm-image-preparation',
  )
  const memoryEnv = {
    VM_POOL_MEMORY_MB: String(resources.memoryMiB),
    VM_BOOT_MEMORY_MB: String(resources.bootMemoryMiB),
    VM_MEMORY_BLOCK_MB: String(resources.blockMemoryMiB),
    VM_MEMORY_DEVICE_ID: resources.memoryDeviceId,
    VM_CAPACITY: String(store.capacity),
  }
  const memoryPool = sdk.SubContainer.of(
    effects,
    { imageId: 'main' },
    sdk.Mounts.of()
      .mountVolume({
        volumeId: 'scratch',
        subpath: './vm-pool',
        mountpoint: '/pool',
        readonly: false,
      })
      .mountVolume({
        volumeId: 'scratch',
        subpath: './vm-workers',
        mountpoint: '/workers',
        readonly: true,
      }),
    'vm-memory-pool',
  )
  let daemons = sdk.Daemons.of(effects)
    .addOneshot('prepare-vm', {
      subcontainer: preparer,
      exec: {
        command: ['bash', '/usr/local/bin/prepare-vm.sh'],
        user: 'root',
        env: {
          VM_DOCKER_PORT: '23650',
          VM_MEMORY_MB: String(preparationResources.memoryMiB),
          VM_CPU_CORES: String(preparationResources.cpuCores),
        },
      },
      requires: [],
    })
    .addDaemon('memory-pool', {
      subcontainer: memoryPool,
      exec: {
        command: ['python3', '-B', '/usr/local/bin/vm-pool.py', 'serve'],
        user: 'root',
        env: memoryEnv,
      },
      ready: {
        display: i18n('Guest Memory Pool'),
        fn: async () => {
          const status = await memoryPool.exec(
            [
              'sh',
              '-ec',
              'pid=$(cat /pool/manager.pid); kill -0 "$pid"; grep -qF /usr/local/bin/vm-pool.py /proc/$pid/cmdline; python3 -B /usr/local/bin/vm-pool.py status',
            ],
            { user: 'root', timeout: 10000 },
          )
          return {
            result: status.exitCode === 0 ? 'success' : 'failure',
            message:
              status.exitCode === 0
                ? i18n('Shared guest-memory controller is running')
                : i18n('Guest-memory controller is not running'),
          }
        },
      },
      requires: ['prepare-vm'],
    })
  for (let slot = 0; slot < store.capacity; slot++) {
    const port = 23750 + slot
    const controllerPath = `./controller/workers/${slot}`
    const guest = sdk.SubContainer.of(
      effects,
      { imageId: 'main' },
      sdk.Mounts.of()
        .mountVolume({
          volumeId: 'scratch',
          subpath: './vm-pool',
          mountpoint: '/pool',
          readonly: false,
        })
        .mountVolume({
          volumeId: 'scratch',
          subpath: './vm-images',
          mountpoint: '/base',
          readonly: true,
        })
        .mountVolume({
          volumeId: 'scratch',
          subpath: `./vm-workers/${slot}`,
          mountpoint: '/vm',
          readonly: false,
        })
        .mountVolume({
          volumeId: 'main',
          subpath: controllerPath,
          mountpoint: '/data',
          readonly: false,
        }),
      `vm-worker-${slot}`,
    )
    const rejection = rejectedUuid(controllerPath)
    daemons = daemons.addDaemon(`worker-${slot}`, {
      subcontainer: guest,
      exec: {
        command: ['bash', '/usr/local/bin/vm-worker.sh'],
        user: 'root',
        env: {
          ...env,
          ...memoryEnv,
          VM_SLOT: String(slot),
          RUNNER_BEFORE_JOB: '/usr/local/bin/request-vm.sh',
          RUNNER_CAPACITY: '1',
          RUNNER_EMULATION: String(store.emulation),
          RUNNER_SCRATCH_DIR: '/var/lib/runner-scratch',
          VM_DOCKER_PORT: String(port),
          VM_DISK_GB: String(diskGiB),
          VM_CPU_CORES: String(resources.cpuCores),
        },
      },
      ready: {
        display: `${i18n('Virtualized Jobs')} ${slot + 1}`,
        gracePeriod: 300000,
        trigger: sdk.trigger.cooldownTrigger(30000),
        fn: async () => {
          if ((await rejection.read().once())?.trim() === store.runnerUuid) {
            return {
              result: 'failure',
              message: i18n(
                'Forgejo no longer recognizes this runner. Create a new runner in Forgejo, enter its UUID and token in the Configure action, then restart this service.',
              ),
            }
          }
          const status = await guest.exec(
            [
              'sh',
              '-ec',
              `controller=$(cat /vm/controller.pid); kill -0 "$controller"; grep -qF /usr/local/bin/vm-worker.sh /proc/$controller/cmdline; case "$(cat /vm/phase)" in idle) if grep -qx forgejo-runner /proc/[0-9]*/comm; then echo idle; else echo starting; fi;; budget|booting|recycling) echo starting;; ready) kill -0 "$(cat /vm/qemu.pid)"; grep -qx forgejo-runner /proc/[0-9]*/comm; curl -fsS --max-time 4 --cacert /data/tls/client/ca.pem --cert /data/tls/client/cert.pem --key /data/tls/client/key.pem https://127.0.0.1:${port}/_ping >/dev/null; echo ready;; *) exit 1;; esac`,
            ],
            { user: 'root', timeout: 5000 },
          )
          return {
            result:
              status.exitCode !== 0
                ? 'failure'
                : String(status.stdout).trim() === 'starting'
                  ? 'starting'
                  : 'success',
            message:
              status.exitCode === 0
                ? String(status.stdout).trim() === 'idle'
                  ? i18n('Waiting for a job; no VM allocated')
                  : String(status.stdout).trim() === 'starting'
                    ? i18n('Preparing a disposable VM')
                    : i18n('Guest Docker is responding')
                : i18n('Virtualized job slot is not running'),
          }
        },
      },
      requires: ['prepare-vm'],
    }) as typeof daemons
  }
  return daemons
})
