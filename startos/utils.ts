import { sdk } from './sdk'

// ---- Resource gate ----
// A CI runner only makes sense on a box with real headroom: every job runs a
// full build (compilers, image pulls, nested containers). These are the floor
// below which we refuse to run; enforced in main.ts via node:os.
export const MIN_MEMORY_BYTES = 2 * 1024 ** 3 // 2 GiB
export const MIN_CPU_CORES = 2

// ---- Local forge ----
// When the runner is pointed at a Forgejo on this same device, it's reachable
// on the internal StartOS network here (see forgejo-startos interfaces/utils).
export const LOCAL_FORGE_URL = 'http://forgejo.startos:3000'

// ---- Paths (inside the service container) ----
export const DATA_DIR = '/data'
// Persist Podman's layer store on the data volume so job images survive
// restarts instead of being re-pulled every boot.
export const PODMAN_ROOT = '/data/containers/storage'
// Registration state written by `forgejo-runner register`; its presence is how
// we make registration idempotent across restarts.
export const RUNNER_STATE = '/data/.runner'

export const mount = sdk.Mounts.of().mountVolume({
  volumeId: 'main',
  subpath: null,
  mountpoint: DATA_DIR,
  readonly: false,
})
