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

In virtualized mode, each slot runs a host-side `one-job --wait` process against Docker inside a disposable KVM guest. Concurrent slots share one persistent Forgejo identity, not a guest or Docker daemon. Each completed job destroys its guest disk, seed and transport keys before a replacement guest starts. No service Docker socket or parent filesystem is exported to a guest.

The first virtualized start downloads a checksum-pinned Debian cloud image and prepares a cached Docker guest. Preparation never receives Forgejo registration credentials. Prepared images are rebuilt when their pinned image or provisioning inputs change; jobs always use separate writable overlays.

In container mode, `container-engine` runs rootful Docker within the StartOS service. `runner-controller` has its own filesystem and persistent controller state. Jobs receive privileged containers, the service-local engine socket and scratch; they share the StartOS kernel and can control that engine's other jobs. This is not VM isolation. Docker uses fuse-overlayfs, retained namespace-local binfmt registration, and `runc-nested` to remove the unsupported nested sysctl.

| Subcontainer | Purpose |
| --- | --- |
| `vm-image-preparation` | Download, verify and prepare the guest base |
| `vm-worker-N` | Host-side controller and hypervisor for slot N, starting at zero |
| `container-engine` | Docker engine when virtualization is off or unavailable |
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
| `scratch/vm-workers/N` | `/vm` in worker N | Disposable job disk, seed, serial log and hypervisor state |
| `scratch/container` | `/scratch` in container engine/controller | Persistent image layers, nested build scratch and transient sockets |

VM jobs bind guest-local `/var/lib/runner-scratch` at `/root/setup-docker-action`, plus the guest resolver and Unix Docker socket. Container jobs use `/scratch/jobs` from the engine filesystem instead. These keep nested Docker storage off layered job roots. A workflow selecting a different nested-daemon directory needs an equivalent scratch arrangement.

## File Models

`store.json` is a loose JSON model seeded by merging defaults. It owns `runnerUuid`, `runnerToken`, `labels`, `capacity`, `emulation` and `virtualization`; unmodeled keys survive writes. The configuration action updates these values, and reactive reads restart execution when they change.

Each controller regenerates `/data/runner/config.yaml` at launch from settings and the resolved Forgejo address. Hand edits do not survive. Runner privilege policy, engine endpoint and mounts are package-controlled. Controller Docker clients use an empty registry-auth configuration; job-provided credentials are distinct from controller credentials.

A controller's `runner/rejected-uuid` records a registration Forgejo no longer recognizes. The entrypoint waits instead of repeatedly reconnecting with that UUID. Changing the configured UUID clears that condition on the next launch.

## Dependencies

Forgejo is required, must be running and pass its primary health check, and must have Actions enabled. The runner resolves its bridge address reactively; remote Forgejo instances are not configurable. No Forgejo volume is mounted.

## Network Access and Interfaces

The package exposes no user-facing interfaces. Controllers dial Forgejo over its service bridge and fetch action repositories and images outbound.

QEMU uses user networking. Each guest Docker API is forwarded to a distinct service-loopback port starting at 23750; image preparation uses 23650. Every guest gets a unique CA and server-only certificate. Client private keys and the CA signing key are never seeded into guests. Mutual TLS is required even on loopback: QEMU's guest host alias can reach the parent loopback namespace. There are no guest SSH forwards.

Container mode uses bridge `runner` at `172.18.0.1/24`, with job networks from `172.20.0.0/16`. Avoid conflicting workflow networks.

## Installation and First-Run Flow

Initialization merges settings defaults and raises a critical setup prompt until registration credentials are present. Hardware virtualization availability is checked by opening the service's KVM device. A missing or inaccessible device forces container mode; an actual VM startup failure does not.

The hardware floor is two CPU cores and the four-gigabyte memory class. Virtualized slots divide half the service-visible RAM, with at least 512 MiB per guest. Their disk limits divide half the free scratch space observed at startup, capped at 32 GiB and requiring at least 8 GiB per guest. Host control and hypervisor overhead remain additional; other services compete for resources. Lower concurrency for large builds.

Guest RAM is demand-allocated, with virtio free-page reporting enabled. This can release free guest pages but is not container-style shared RAM or host-wide KSM.

## Actions

Use configuration to change registration, routing or execution policy. It rewrites the settings model and restarts execution, interrupting active work. Repeating identical settings is safe; there is no additional registration created per slot or job.

## Tasks

A critical configuration task blocks service startup while credentials are missing, labels are invalid, or the selected VM concurrency cannot fit its resource budget. Correcting the settings clears it. These conditions can recur after a restore or hardware/storage change.

When Forgejo Actions is disabled, the dependency receives a task targeting its Configure action. Enabling Actions clears that dependency task.

## Health Checks

Container readiness checks the controller process and its engine. A separate informational check explains why container mode is selected. Engine failure prevents the controller from polling.

Each VM slot checks its live hypervisor during boot, then its runner process and mutually authenticated guest Docker API. The startup grace period allows preparation and boot; serial logs in its scratch directory distinguish provisioning failure from a broken runner. A rejected registration produces the same credential-replacement diagnostic in either mode.

A guest exiting before its controller completes fails that slot. Its controller has up to three minutes to report the failed job before the entire controller process group is terminated and its state disposed. Replacement never starts a local container engine. Unexpected controller termination can leave Forgejo to time out its assigned task; jobs are not automatically replayed by the package.

## Backups and Restore

Backups copy the entire `main` volume, including settings and controller state. `scratch` is excluded wholesale: guest images, disposable disks, container layers and build caches are reconstructible.

A restored service must still have Forgejo and a recognized persistent registration. Guest bases rebuild, container images repull, and transport certificates are regenerated. A registration absent from Forgejo needs replacement credentials.

## Limitations and Differences

1. Only Docker-backed labels are accepted. Labels route jobs; Forgejo registration scope authorizes repositories.
2. Container-mode jobs must be trusted with their engine and the shared StartOS kernel. A VM adds a guest-kernel boundary, not protection against every hypervisor, controller or resource-exhaustion vulnerability.
3. VM job disks and image/build caches are discarded after each job. The runner-side action cache server is disabled in VM mode; do not depend on its service-side cache URLs or guest-published ports appearing on the parent loopback address.
4. Persistent registrations are mandatory. Ephemeral registration deletion is incompatible with sharing one identity across slots.
5. Initial guest preparation needs outbound access to the pinned cloud image, Debian repositories and helper image. Failed preparation does not change execution mode.
6. Guest memory and disk are bounded, but CPU, networking and the StartOS host remain shared resources. Increasing concurrency can reduce memory available to each job.
7. Foreign-architecture labels use slower user-mode emulation inside the selected execution environment; native workers are preferable for regular builds.

## Quick Reference for AI Consumers

```yaml
package_id: forgejo-runner
image: ./Dockerfile
architectures: [x86_64, aarch64]
subcontainers: [vm-image-preparation, vm-worker-N, container-engine, runner-controller]
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
  - VM_CPU_CORES
  - VM_DISK_GB
dependencies: [forgejo]
interfaces: {}
actions: [configure]
tasks:
  - { action: configure, severity: critical }
  - { package: forgejo, action: configure, severity: critical }
health_checks: [worker-N, runner, execution-mode]
```
