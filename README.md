<p align="center">
  <img src="icon.svg" alt="Forgejo Runner Logo" width="21%">
</p>

# Forgejo Runner on StartOS

> Everything not listed in this document should behave the same as upstream
> Forgejo Runner. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

[Forgejo Runner](https://code.forgejo.org/forgejo/runner) executes Forgejo Actions workflows. This package runs it against the Forgejo on this same device, with a Docker engine inside the service so each job gets its own container.

- **Upstream repo:** <https://code.forgejo.org/forgejo/runner>
- **Wrapper repo:** <https://github.com/Start9Labs/forgejo-runner-startos>

---

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

---

## Image and Container Runtime

The image is built here: upstream's runner binary is copied onto a Debian base carrying Docker CE, fuse-overlayfs, jq, and git. A digest-pinned `tonistiigi/binfmt` stage supplies the registration helper and static QEMU interpreters.

| Property      | Value                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| Image         | Built from `Dockerfile` — upstream's `forgejo-runner` binary plus Docker CE |
| Architectures | x86_64, aarch64                                                          |
| Command       | The repo's `entrypoint.sh`, run as the unprivileged `app` user           |
| Subcontainer  | `forgejo-runner-sub` — the `primary` daemon, and the one to `attach` to  |

The `engine` daemon runs Docker as root **inside the StartOS service's user namespace**, not as host root. The runner remains the unprivileged `app` user and connects through a group-accessible Unix socket. Job IDs use the service's full 0–65535 mapping, including apt's `nogroup` (65534), without another subordinate-ID namespace.

The manifest grants **userspace filesystems** for Docker's fuse-overlayfs storage driver. `assets/daemon.json` selects that driver and the `runc-nested` runtime. The runtime wrapper removes `net.ipv4.ip_unprivileged_port_start` from OCI specs before invoking runc; reopening that sysctl across the StartOS namespace boundary can fail.

The generated runner configuration enables privileged job containers and mounts the engine socket at `/var/run/docker.sock`. Workflows can therefore control the service's Docker engine, including other jobs and volumes. **Only run trusted workflows.** StartOS's outer user-namespace and AppArmor confinement still apply.

`own-data` prepares the working and scratch directories without recursively changing file ownership. `clean-runtime` recreates the socket/PID directory before `engine` starts; `primary` waits for Docker to answer `info`. Image storage is separate and survives service restarts. The engine entrypoint registers QEMU on a private `binfmt_misc` mount and keeps it mounted for the daemon's lifetime. Registrations belong to the service's user namespace, not the StartOS host.

## Volume and Data Layout

| Volume | Mount Point | Purpose |
| ------ | ----------- | ------- |
| `main` | `/data` | `store.json` and runner registration/configuration under `runner/` |
| `scratch` | `/scratch` | Docker image storage under `docker/` and nested build-daemon working directories under `jobs/`; excluded from backups |

Every job bind-mounts `/scratch/jobs` at `/root/setup-docker-action`, the default runtime base directory of `docker/setup-docker-action`. Its per-invocation directories live on the volume rather than the job's layered root filesystem, allowing the inner Docker daemon to mount its own image layers. Workflows using a different runtime base directory must arrange an equivalent scratch mount. Jobs also receive a read-only bind of the service's `/etc/resolv.conf`; nested Docker daemons must inherit real StartOS DNS servers rather than the outer Docker network's loopback resolver. The action cleans up its runtime data; stopped or interrupted jobs can leave disposable directories behind.

## File Models

Two models: the runner's registration and job configuration, and a marker the entrypoint leaves when Forgejo rejects those credentials.

| File                   | Format | Modelled                  | Written by                                         |
| ---------------------- | ------ | ------------------------- | -------------------------------------------------- |
| `store.json`           | JSON   | Yes — `FileHelper.json`   | Every init, and the Configure action               |
| `runner/rejected-uuid` | Text   | Yes — `FileHelper.string` | `entrypoint.sh`, when Forgejo rejects `runnerUuid` |

| Key                         | Notes                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `runnerUuid`, `runnerToken` | The credentials Forgejo shows when you create a runner. Both present is what counts as configured |
| `labels`                    | Comma-separated, in the runner's own `name:docker://image` or `name:host` syntax                  |
| `capacity`                  | How many jobs run at once                                                                         |
| `emulation`                 | Whether to also advertise the other CPU architecture                                              |

Nothing but the package writes `store.json`. The entrypoint generates `/data/runner/config.yaml` from the environment on each start; inspect it for diagnosis, but do not edit it. The connection to Forgejo is resolved rather than stored.

The one value the package composes rather than passes through is the label list. With emulation enabled it appends a foreign-architecture label pinned to that platform, so jobs targeting the other architecture use the engine's namespace-local QEMU interpreters. The runner process itself always runs natively.

## Dependencies

One, and it is required in the strong sense.

| Dependency | Kind      | Health check | Mounts | Why                                            |
| ---------- | --------- | ------------ | ------ | ---------------------------------------------- |
| Forgejo    | `running` | `primary`    | none   | The forge this runner registers with and polls |

The health check is required as well as "running", because the runner talks to Forgejo's HTTP API — a Forgejo that is up but not yet serving is no use to it.

Forgejo Actions must also be enabled. The package raises a critical task on Forgejo's **Configure** action whenever Enable Actions is off, which holds Forgejo stopped until it is turned back on.

**This runner only ever serves the Forgejo on this device.** The address is resolved from Forgejo's own binding over the service bridge; there is no field for a remote forge. If Forgejo is not reachable, `main` refuses to start with a message saying so rather than starting a runner that cannot register.

## Network Access and Interfaces

None. The runner dials out to its forge and pulls job images; it accepts no inbound connections and exports nothing.

## Installation and First-Run Flow

Install seeds the store with defaults. On every init, a watcher raises a critical **Configure** task if either the runner UUID or token is missing, blocking startup until both are saved. Already-configured installs and restores do not receive a setup task.

Two gates apply before that, both enforced rather than advisory:

1. **Hardware.** `main` refuses to start on a device below 2 CPU cores or roughly a 4 GB machine's worth of memory, because every job is a full build. The message says so explicitly rather than failing obscurely later.
2. **Forgejo.** It must be installed and serving.

Complete the **Configure** task with the UUID and token Forgejo shows under **Settings → Actions → Runners → Create new Runner**, then start the service.

## Actions

One action.

### Configure

Connects the runner to Forgejo and sets how it advertises itself.

- **What it changes:** every field in `store.json` — the credentials, labels, concurrency, and the emulation toggle.
- **Cost:** `main` reads the whole store reactively, so **saving a change restarts the runner if it is running.** A stopped service picks the values up when it next starts.
- **Repeat safety:** idempotent; the form is pre-filled with the current values and replaces them wholesale.
- **Input notes:** labels use the runner's own syntax. Do not add architecture labels by hand for foreign-architecture jobs — the emulation toggle exists to append the correct pinned label, and a hand-written one will not carry the platform pin.

## Tasks

One setup task of its own and one on its dependency:

| Task      | On             | Severity   | Raised when                     | Cleared when                     |
| --------- | -------------- | ---------- | ------------------------------- | -------------------------------- |
| Configure | Forgejo Runner | `critical` | Runner UUID or token is missing | Configure saves both credentials |
| Configure | Forgejo        | `critical` | Forgejo's Enable Actions is off | Enable Actions is turned on      |

## Health Checks

A hidden Docker readiness check gates `primary`, which exposes the Runner check.

| Check              | Method                                                                                          | Grace Period |
| ------------------ | ----------------------------------------------------------------------------------------------- | ------------ |
| `primary` "Runner" | Credentials not rejected by Forgejo, then the runner process alive and the Docker API answering | 60 seconds   |

Missing credentials are handled by the setup task, not readiness. The check fails while `runner/rejected-uuid` holds the configured UUID: the entrypoint writes it when Forgejo answers `unregistered runner` (its database no longer holds that runner, as after Forgejo is reinstalled), then idles instead of exiting, so the service waits for new credentials rather than restarting in a loop. Saving a different UUID clears it on the next start. With valid credentials it runs a script in the service container every 30 seconds: a `forgejo-runner` process must appear in `/proc`, and `docker info` must succeed against the API socket the runner drives. Both have to hold — the runner exits when the engine is unreachable, and an engine with no runner behind it serves nothing. Whether Forgejo is currently handing it jobs is visible in Forgejo, not here.

## Backups and Restore

The `main` volume is copied wholesale — `sdk.Backups.ofVolumes('main')`. The `scratch` volume is excluded; engine images and build scratch are disposable.

- **Included:** the runner's credentials, configuration, and rejection marker.
- **Restore:** the runner comes back configured against the same UUID and token. Whether Forgejo still recognises them depends on Forgejo's own state, which is that package's backup rather than this one's — if the forge was rebuilt, register the runner again.

## Limitations and Differences

1. **Only the Forgejo on this device.** There is no field for a remote forge; the address is resolved from the local dependency.
2. **Saving Configure restarts a running runner**; the runner's configuration is regenerated on each start, never reloaded live.
3. **The service refuses to start on small hardware** — under 2 cores or roughly a 4 GB machine.
4. **Emulated jobs are much slower than native.** The toggle exists for occasional cross-architecture work; a native runner per architecture is the better arrangement for regular builds.
5. **Jobs run privileged and can control the service's Docker engine.** Run only trusted workflows; jobs on this runner are not a security boundary from one another.
6. **No riscv64 build.** x86_64 and aarch64 only, and the image is not run under emulation on any other architecture.

---

## Quick Reference for AI Consumers

```yaml
package_id: forgejo-runner
image: ./Dockerfile # upstream's runner binary plus Docker CE on Debian
architectures:
  - x86_64
  - aarch64
subcontainers:
  - forgejo-runner-sub
volumes:
  main: /data
  scratch: /scratch # excluded from backups
file_models:
  - store.json
  - runner/rejected-uuid
startos_managed_env_vars:
  - INSTANCE_URL
  - RUNNER_UUID
  - RUNNER_TOKEN
  - RUNNER_LABELS
  - RUNNER_CAPACITY
  - DOCKER_HOST
  - RUNNER_SCRATCH_DIR
  - BINFMT_DIR
dependencies:
  - forgejo # required; gated on its primary health check
interfaces: {} # none; the runner accepts no inbound connections
actions:
  - configure
tasks:
  - { package: forgejo-runner, action: configure, severity: critical } # while either credential is missing
  - { package: forgejo, action: configure, severity: critical } # while Forgejo Actions is disabled
health_checks:
  - primary # displayed "Runner"; rejected credentials, then runner + engine liveness
```
