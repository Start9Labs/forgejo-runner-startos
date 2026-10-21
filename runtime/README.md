# Shared CI runner runtime

This module and the scripts in `runtime/assets/` own the execution primitives shared by StartOS runner packages. Consumers pin this package through their npm lockfile. Import `runtime` directly: it has no package manifest, registration model or SDK instance dependency. Include `node_modules/forgejo-runner-startos/runtime/**/*.ts` in the consumer's `tsconfig.json` so NCC emits dependency TypeScript.

## Policy API

- `guestResources` computes the aggregate guest-memory budget, boot floor, hotplug blocks and CPU share. `null` means the requested capacity cannot fit. Callers translate their own configuration error.
- `guestDiskGiB` computes each guest's bounded disk size from available scratch MiB and capacity. Zero means insufficient or invalid input.
- `resolveRunnerLabels` validates Docker-only, unique labels and adds an explicitly targeted foreign-architecture label when emulation is enabled. Its error strings are translation keys, not permission to fall back to host execution.
- `installRootCa` consumes the public certificate from `sdk.getRootCa`; private-key bundles and service leaf certificates are not inputs.
- `installLocalHosts` applies the SDK-derived hostname/IP aliases to each controller/engine rootfs. Docker `--add-host` affects jobs, not controller-side action clones; install aliases in both places. It replaces only its marked lines.
- `BINFMT_IMAGE` pins the host helper. Pass it as the `BINFMT_IMAGE` Docker build argument; the package manifest supplies it for normal builds.
- `VM_PREPARATION_STATUS`, `VM_PREPARATION_PROBE`, `vmPreparationState`, `VM_POOL_PROBE` and `vmPoolState` share preparation/broker status without coupling worker lifetimes.
- `vmJobProbe` and `vmJobState` share process/API liveness and phase semantics. The package remains responsible for registration rejection, translated messages, and keeping display checks independent from daemon readiness.

## Controller protocol

Copy `runtime/assets/` to `/usr/local/share/ci-runner/` in a fresh Debian trixie image and run its `install-runtime.sh` as root. It installs prerequisites, the unprivileged `app` user and the existing `/usr/local/bin`, `/usr/local/libexec` and guest-template paths. `guest-images.json` pins cloud images and the guest helper image. Preserve `assets/LICENSE` when distributing the runtime; npm omits the package root's submodule-relative license symlink.

`vm-worker.sh` invokes `/usr/local/bin/entrypoint.sh one-job --wait` in a new process group. That package-specific adapter must wait for exactly one assignment and use `request-vm.sh` as its trusted host-side before-job hook. The hook must run with a live task reporter before Docker access. Normal completion returns after reporting and cleanup; registration rejection must remain observable by package health checks. The adapter owns runner-specific CLI, configuration and credentials, not the generic worker.

The worker owns the guest lifecycle, memory lease and stop-before-release ordering. `/vm` holds disposable state, `/data` holds host-controller state and transport client identity, `/base` is the read-only prepared image, and `/pool` is the shared broker directory. `VM_GUEST_HOSTNAME` names the guest and defaults to `runner-job`. Neither `/data` nor the parent service's engine socket may be mounted into the guest. The seed contains the public OS CA and guest-specific server identity, not the OS private key, CA signing key, Docker client private key or registration state.

Use the shared resource and status policy without copies. Registration formats and their authoritative storage remain the consuming package's responsibility. A reusable-workflow assignment must not multiply executable jobs inside its guest; the runner adapter/source patch supplies that scheduling bound.
