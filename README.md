<p align="center">
  <img src="icon.svg" alt="Forgejo Runner Logo" width="21%">
</p>

# Forgejo Runner on StartOS

> Everything not listed in this document should behave the same as upstream
> Forgejo Runner. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

[Forgejo Runner](https://code.forgejo.org/forgejo/runner) executes workflows for the Forgejo on this device. One persistent registration serves all execution slots.

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

## Image and Container Runtime

The custom Debian runtime builds the pinned upstream submodule with carried source-root containment patches. It includes Docker, QEMU system emulators and digest-pinned binfmt interpreters. The application license is upstream's GPL license.

In virtualized mode, each slot polls with a host-side `one-job --wait` process and no idle guest. A carried `runner.before_job` hook runs after assignment, with the job reporter active, and waits for memory admission and a fresh KVM guest before Docker access. Concurrent assigned tasks share one persistent Forgejo identity, not a guest or Docker daemon. A remote reusable workflow can contain several nested jobs or matrix entries inside one assigned task; those share that task's guest and RAM grant and execute sequentially. Patch `0006` serializes both job groups and matrix entries at every reusable-workflow depth, so one assignment cannot multiply active job environments. Configured concurrency permits separate Forgejo assignments to run in parallel; raising it does not parallelize the children of a single assignment. Completion destroys the guest disk, seed and transport keys, then returns the memory lease. No replacement guest starts until another job is assigned. No service Docker socket or parent filesystem is exported to a guest. Routine empty polls are debug-level; job pickup and polling errors remain visible at the default log level.

The first virtualized start downloads a checksum-pinned Debian cloud image and prepares a cached Docker guest. Preparation never receives Forgejo registration credentials. Prepared images are rebuilt when their pinned image or provisioning inputs change; jobs always use separate writable overlays.

In container mode, `container-engine` runs rootful Docker within the StartOS service. `runner-controller` has its own filesystem and persistent controller state. Jobs receive privileged containers, the service-local engine socket and scratch; they share the StartOS kernel and can control that engine's other jobs. This is not VM isolation. Docker uses fuse-overlayfs, retained namespace-local binfmt registration, and `runc-nested` to remove the unsupported nested sysctl.

| Subcontainer | Purpose |
| --- | --- |
| `vm-image-preparation` | Download, verify and prepare the guest base |
| `vm-memory-pool` | Admit guests and redistribute a single RAM budget |
| `vm-worker-N` | Host-side controller and hypervisor for slot N, starting at zero |
| `container-engine` | Docker engine when virtualization is explicitly off |
| `runner-controller` | One multi-job controller in container mode |

## Volume and Data Layout

Persistent configuration and controller state are separate from reconstructible images and job scratch. Neither execution engine mounts the central settings file.

| Volume path | Mount | Contents |
| --- | --- | --- |
| `main/store.json` | File-model access only | Registration and execution settings |
| `main/controller/workers/N` | `/data` in VM worker N | Generated runner configuration, logs, rejection marker, active client TLS keys |
| `main/controller/container` | `/data` in container controller | Generated runner configuration, logs and rejection marker |
| `scratch/vm-images` | `/cache` in preparation; read-only `/base` in workers | Verified cloud image and prepared base |
| `scratch/vm-preparation/runtime` | `/vm` in preparation | Temporary preparation disk and seed |
| `scratch/vm-preparation/control` | `/data` in preparation | Temporary TLS and provisioning state |
| `scratch/vm-workers/N` | `/vm` in worker N; read-only `/workers/N` in memory manager | Disposable disk, seed, serial log, QMP socket and lease identity |
| `scratch/vm-pool` | `/pool` in manager and workers | Host-only control socket and recoverable memory reservations |
| `scratch/container` | `/scratch` in container engine/controller | Persistent image layers, nested build scratch and transient sockets |

VM jobs bind guest-local `/var/lib/runner-scratch` at `/root/setup-docker-action`, plus the guest resolver and Unix Docker socket. Container jobs use `/scratch/jobs` from the engine filesystem instead. These keep nested Docker storage off layered job roots. A workflow selecting a different nested-daemon directory needs an equivalent scratch arrangement.

## File Models

`store.json` is a loose JSON model seeded by merging defaults. It owns `runnerUuid`, `runnerToken`, `labels`, `capacity`, `emulation` and `virtualization`; unmodeled keys survive writes. The configuration action updates these values, and reactive reads restart execution when they change.

Each controller regenerates `/data/runner/config.yaml` at launch from settings and the resolved Forgejo address. Hand edits do not survive. Runner privilege policy, engine endpoint and mounts are package-controlled. Controller Docker clients use an empty registry-auth configuration; job-provided credentials are distinct from controller credentials.

Every assigned job gets a private controller-side action-source cache, removed when execution returns. Actions can reuse fetched sources within that job but are fetched separately for subsequent jobs in both modes. Abandoned Git locks in an older cache cannot block a new job; the runner does not delete lock files from another job's cache.

A controller's `runner/rejected-uuid` records a registration Forgejo no longer recognizes. The entrypoint waits instead of repeatedly reconnecting with that UUID. Changing the configured UUID clears that condition on the next launch.

## Dependencies

Forgejo is required, must be running and pass its primary health check, and must have Actions enabled. The runner resolves its bridge address reactively; remote Forgejo instances are not configurable. No Forgejo volume is mounted.

## Network Access and Interfaces

The package exposes no user-facing interfaces. Controllers dial Forgejo over its service bridge and fetch action repositories and images outbound.

Artifact uploads also use URLs signed by Forgejo under its configured Primary URL. The package installs the OS's public root certificate in controller and guest trust stores, then adds it to each workflow job container before actions run. Debian/Ubuntu/Alpine system stores use `update-ca-certificates`; images with `update-ca-trust` use that updater instead. Node actions also receive `NODE_EXTRA_CA_CERTS` pointing at the public certificate in their shared action volume. Images without a system trust updater retain Node's extra-certificate support but must provide their own system trust tooling for other clients.

Forgejo's derived mDNS hostnames are mapped to the OS bridge in workflow job containers, preserving the requested hostname, SNI and certificate verification. Neither TLS verification nor hostname checks are disabled. Only the public CA is copied; controller registration credentials, OS private keys and per-VM Docker client keys stay outside guests. Custom Docker action images can read the shared public certificate through Node's extra-CA environment; their system trust tooling and DNS configuration remain the image/workflow's responsibility.

QEMU uses user networking. Each guest Docker API is forwarded to a distinct service-loopback port starting at 23750; image preparation uses 23650. Every guest gets a unique CA and server-only certificate. Client private keys and the CA signing key are never seeded into guests. Mutual TLS is required even on loopback: QEMU's guest host alias can reach the parent loopback namespace. There are no guest SSH forwards.

Container mode uses bridge `runner` at `172.18.0.1/24`, with job networks from `172.20.0.0/16`. Avoid conflicting workflow networks.

## Installation and First-Run Flow

Initialization merges settings defaults and raises a critical setup prompt until registration credentials are present. Hardware virtualization availability is checked by opening the service's KVM device. New settings default to container mode without accessible KVM. If virtualization is already enabled and KVM becomes unavailable, a critical Configure task blocks startup and main refuses to create either backend. Restore KVM access and restart, or explicitly save Configure with Virtualization off to use containers. The saved choice and registration are not automatically changed; the task clears when the selected backend is usable. VM startup failures also never select container mode.

The hardware floor is two CPU cores and the four-gigabyte memory class. Half the service-visible RAM, rounded down to 128 MiB blocks, forms one guest-memory pool. Configured concurrency must fit a 512 MiB boot floor per simultaneous guest. A lone active job may use the whole pool; new assignments divide fair targets among active and waiting jobs. Idle slots have no VM or guest-memory commitment.

Guests boot with the fixed floor and a zero-sized virtio-mem expansion. Before Docker readiness, cloud-init enables Linux's `auto-movable` onlining policy with a 301% movable-to-kernel ratio. Borrowed RAM expands kernel zones as well as movable memory; forcing every hotplugged block into `ZONE_MOVABLE` can exhaust kernel allocations despite gigabytes of free guest RAM. The manager grants additional blocks through QMP and waits for actual device-size acknowledgement before admitting execution or reusing reclaimed memory. Busy or kernel-pinned blocks can delay reclamation; another assigned job waits rather than overcommitting the pool. Reservations survive manager restart; active guests remain running during an isolated manager-process restart. The manager verifies each QEMU lease identity before changing its memory.

Disk limits divide half the free scratch space observed at startup, capped at 32 GiB and requiring at least 8 GiB per guest. Host control, hypervisor and guest-kernel metadata overhead remain additional; this is not a total service RSS cap. Other services compete for resources. Free-page reporting can release unused physical pages within grants; there is no cross-guest RAM deduplication or host-wide KSM.

## Actions

Use configuration to change registration, routing or execution policy. It rewrites the settings model and restarts execution, interrupting active work. Repeating identical settings is safe; there is no additional registration created per slot or job.

## Tasks

A critical configuration task blocks service startup while credentials are missing, labels are invalid, or the selected VM concurrency cannot fit its resource budget. Correcting the settings clears it. These conditions can recur after a restore or hardware/storage change.

When Forgejo Actions is disabled, the dependency receives a task targeting its Configure action. Enabling Actions clears that dependency task.

## Health Checks

Container readiness checks the controller process and its engine. A separate informational check explains why container mode is selected. Engine failure prevents the controller from polling.

**VM Image Preparation** reports loading while the base image is downloaded and provisioned, success after preparation and cleanup finish, and failure on an error or a dead preparation process. A fresh status marker is required on every service start; a cached prepared image completes this check quickly. The preparation oneshot remains the startup barrier for the memory manager and workers. The progress check never controls their lifetime.

An idle VM slot checks its supervisor and runner process and reports **success** with no VM allocated. The visible job-phase check reports **loading** while preparing or running an assigned job; it does not gate workers or the memory manager. Hidden controller readiness remains successful while idle or executing, and starting during memory admission and boot. Active execution additionally checks its hypervisor and mutually authenticated guest Docker API. The memory manager has its own process/control-socket check. Serial logs distinguish guest provisioning failures. A rejected registration produces the same credential-replacement diagnostic in either mode.

A guest or provisioning failure fails that slot. Its controller has up to three minutes to report the failed job before the entire controller process group is terminated. The VM is stopped before its memory reservation is released. The next polling process has no guest until another assignment; failure never starts a local container engine. Unexpected controller termination can leave Forgejo to time out its assigned task; jobs are not automatically replayed by the package.

## Backups and Restore

Backups copy the entire `main` volume, including settings and controller state. `scratch` is excluded wholesale: guest images, disposable disks, container layers and build caches are reconstructible.

A restored service must still have Forgejo and a recognized persistent registration. Guest bases rebuild, container images repull, and transport certificates are regenerated. A registration absent from Forgejo needs replacement credentials.

## Limitations and Differences

1. Only Docker-backed labels are accepted. Labels route jobs; Forgejo registration scope authorizes repositories.
2. Container-mode jobs must be trusted with their engine and the shared StartOS kernel. A VM adds a guest-kernel boundary, not protection against every hypervisor, controller or resource-exhaustion vulnerability.
3. VM job disks and image/build caches are discarded after each job. The runner-side action cache server is disabled in VM mode; do not depend on its service-side cache URLs or guest-published ports appearing on the parent loopback address.
4. Persistent registrations are mandatory. Ephemeral registration deletion is incompatible with sharing one identity across slots.
5. Initial guest preparation needs outbound access to the pinned cloud image, Debian repositories and helper image. Failed preparation does not change execution mode.
6. Guest memory grants and disks are bounded, but CPU, networking and the StartOS host remain shared resources. A job waiting for memory has already been assigned in Forgejo; its logs report provisioning while the shared pool waits for reclamation. Busy or pinned memory can delay another job until an active guest finishes.
7. Foreign-architecture labels use slower user-mode emulation inside the selected execution environment; native workers are preferable for regular builds.

## Shared Runtime Maintenance

`runtime/` owns the generic VM/engine scripts, resource and label policy, public-CA installation, and VM phase/liveness checks used by sibling runner packages. Its [integration contract](runtime/README.md) separates those primitives from this package's Forgejo registration and CLI adapter. Runtime assets install at their existing image paths; changing their source directory does not change persistent data or guest isolation.

## Quick Reference for AI Consumers

```yaml
package_id: forgejo-runner
image: ./Dockerfile
architectures: [x86_64, aarch64]
subcontainers: [vm-image-preparation, vm-memory-pool, vm-worker-N, container-engine, runner-controller]
volumes:
  main: /data
  scratch: /vm
file_models:
  - store.json
  - controller/workers/N/runner/rejected-uuid
  - controller/container/runner/rejected-uuid
startos_managed_env_vars:
  - INSTANCE_URL
  - RUNNER_UUID
  - RUNNER_TOKEN
  - RUNNER_LABELS
  - RUNNER_CAPACITY
  - RUNNER_EMULATION
  - RUNNER_SCRATCH_DIR
  - DOCKER_HOST
  - DOCKER_TLS_VERIFY
  - DOCKER_CERT_PATH
  - VM_DOCKER_PORT
  - VM_MEMORY_MB
  - VM_POOL_MEMORY_MB
  - VM_BOOT_MEMORY_MB
  - VM_MEMORY_BLOCK_MB
  - VM_MEMORY_DEVICE_ID
  - VM_SLOT
  - VM_LEASE
  - RUNNER_BEFORE_JOB
  - VM_CPU_CORES
  - VM_DISK_GB
dependencies: [forgejo]
interfaces: {}
actions: [configure]
tasks:
  - { action: configure, severity: critical }
  - { package: forgejo, action: configure, severity: critical }
health_checks: [memory-pool, worker-N, runner, execution-mode]
```
