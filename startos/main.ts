import { cpus, totalmem } from 'os'
import {
  VM_PREPARATION_STATUS,
  VM_PREPARATION_PROBE,
  VM_POOL_PROBE,
  vmJobProbe,
  vmJobState,
  vmPreparationState,
  vmPoolState,
} from '../runtime'
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
  installRootCa,
  installLocalHosts,
  ROOT_CA_PATH,
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
  const rootCa = await sdk.getRootCa(effects)
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
  const env = {
    INSTANCE_URL: `http://${forgeBridge}`,
    RUNNER_UUID: store.runnerUuid,
    RUNNER_TOKEN: store.runnerToken,
    RUNNER_LABELS: runnerLabels(store).join(','),
    RUNNER_PRIVILEGED: 'true',
    RUNNER_CONFIGURE_ACTION: i18n('Configure'),
    RUNNER_ROOT_CA: ROOT_CA_PATH,
    RUNNER_LOCAL_HOSTS: JSON.stringify(localHosts),
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
    await installRootCa(engine, rootCa)
    await installRootCa(controller, rootCa)
    await installLocalHosts(engine, localHosts)
    await installLocalHosts(controller, localHosts)
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
  await installRootCa(preparer, rootCa)
  await installLocalHosts(preparer, localHosts)
  const preparationStatusPath = VM_PREPARATION_STATUS
  await preparer.execFail(['rm', '-f', preparationStatusPath], {
    user: 'root',
  })
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
          VM_PREPARATION_STATUS: preparationStatusPath,
          RUNNER_ROOT_CA: ROOT_CA_PATH,
        },
      },
      requires: [],
    })
    .addHealthCheck('vm-image', {
      ready: {
        display: i18n('VM Image Preparation'),
        trigger: sdk.trigger.statusTrigger(30000, {
          loading: 1000,
          starting: 1000,
          failure: 5000,
        }),
        fn: async () => {
          const status = await preparer.exec(
            ['sh', '-ec', VM_PREPARATION_PROBE],
            { user: 'root', timeout: 5000 },
          )
          const phase = String(status.stdout).trim()
          const health = vmPreparationState(status.exitCode, phase)
          return { ...health, message: i18n(health.message) }
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
          const status = await memoryPool.exec(['sh', '-ec', VM_POOL_PROBE], {
            user: 'root',
            timeout: 10000,
          })
          const health = vmPoolState(status.exitCode)
          return { ...health, message: i18n(health.message) }
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
    await installRootCa(guest, rootCa)
    await installLocalHosts(guest, localHosts)
    const rejection = rejectedUuid(controllerPath)
    const jobHealth = async () => {
      if ((await rejection.read().once())?.trim() === store.runnerUuid) {
        return {
          result: 'failure',
          message: i18n(
            'Forgejo no longer recognizes this runner. Create a new runner in Forgejo, enter its UUID and token in the Configure action, then restart this service.',
          ),
        } as const
      }
      const status = await guest.exec(
        ['sh', '-ec', vmJobProbe(port, 'forgejo-runner')],
        { user: 'root', timeout: 5000 },
      )
      const phase = String(status.stdout).trim()
      const health = vmJobState(status.exitCode, phase)
      return { ...health, message: i18n(health.message) }
    }
    daemons = daemons
      .addDaemon(`worker-${slot}`, {
        subcontainer: guest,
        exec: {
          command: ['bash', '/usr/local/bin/vm-worker.sh'],
          user: 'root',
          env: {
            ...env,
            ...memoryEnv,
            VM_SLOT: String(slot),
            VM_GUEST_HOSTNAME: 'forgejo-job',
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
          display: null,
          gracePeriod: 300000,
          fn: async () => {
            const health = await jobHealth()
            return health.result === 'loading'
              ? { ...health, result: 'success' }
              : health
          },
        },
        requires: ['prepare-vm'],
      })
      .addHealthCheck(`jobs-${slot}`, {
        ready: {
          display: `${i18n('Virtualized Jobs')} ${slot + 1}`,
          gracePeriod: 300000,
          trigger: sdk.trigger.statusTrigger(30000, {
            success: 1000,
            loading: 1000,
            starting: 1000,
          }),
          fn: async () => {
            const health = await jobHealth()
            return health.result === 'starting'
              ? { ...health, result: 'loading' }
              : health
          },
        },
        requires: ['vm-image'],
      }) as typeof daemons
  }
  return daemons
})
