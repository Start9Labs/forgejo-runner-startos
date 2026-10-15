import { sdk } from './sdk'

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
// under StartOS's host QEMU binfmt. The multi-arch catthehacker default.
export const EMULATION_IMAGE = 'ghcr.io/catthehacker/ubuntu:act-22.04'

// ---- Paths (inside the service container) ----
export const DATA_DIR = '/data'

export const mount = sdk.Mounts.of().mountVolume({
  volumeId: 'main',
  subpath: null,
  mountpoint: DATA_DIR,
  readonly: false,
})
