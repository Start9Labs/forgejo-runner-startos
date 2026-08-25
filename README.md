<p align="center">
  <img src="icon.svg" alt="Forgejo Runner Logo" width="21%">
</p>

# Forgejo Runner on StartOS

> Everything not listed in this document should behave the same as upstream
> Forgejo Runner. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

[Forgejo Runner](https://code.forgejo.org/forgejo/runner) executes Forgejo Actions workflows. This package runs it against the Forgejo on this same device, with a rootless Podman engine inside the service so each job gets its own container.

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

The image is built here: upstream's runner binary is copied onto a Debian base carrying a rootless container engine, because the runner needs somewhere to run each job.

| Property      | Value                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| Image         | Built from `Dockerfile` — upstream's `forgejo-runner` binary plus Podman |
| Architectures | x86_64, aarch64                                                          |
| Command       | The repo's `entrypoint.sh`, run as the unprivileged `app` user           |
| Subcontainer  | `forgejo-runner-sub` — the `primary` daemon, and the one to `attach` to  |

The manifest declares two device grants that this arrangement requires: **userspace filesystems** for the storage driver, and **virtual networking** for job networking. Without either, the nested engine cannot start a job container. The image also carries `git`, because the runner fetches `uses:` actions with the git CLI and every such step fails without it.

Three oneshots run as root before the daemon. `own-data` creates the runner's working directory on the volume and hands it to `app`, leaving the rest of the volume alone. `device-perms` re-opens `/dev/net/tun` and `/dev/fuse` to mode 0666: StartOS 0.4.0.1 and earlier can create those granted nodes root-only, and the engine opens both as the unprivileged user. It is idempotent and becomes a no-op once the OS-side fix ships. `clean-runtime` removes the engine's runroot and libpod tmpdir. Both sit under `XDG_RUNTIME_DIR` on the persistent volume, so they carry the previous boot's ID across a restart and podman refuses to start against a stale one. It runs after `own-data` rather than beside it, so the two never walk the same tree at once, and it removes no durable state: the image layer store is a sibling directory and is left alone.

## Volume and Data Layout

One volume, shared between the package's state and the runner's working area.

| Volume | Mount Point | Purpose                                                              |
| ------ | ----------- | -------------------------------------------------------------------- |
| `main` | `/data`     | `store.json`, and the runner's own working directory under `runner/` |

## File Models

One model, holding the runner's registration and its job configuration.

| File         | Format | Modelled                | Written by                           |
| ------------ | ------ | ----------------------- | ------------------------------------ |
| `store.json` | JSON   | Yes — `FileHelper.json` | Every init, and the Configure action |

| Key                         | Notes                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `runnerUuid`, `runnerToken` | The credentials Forgejo shows when you create a runner. Both present is what counts as configured |
| `labels`                    | Comma-separated, in the runner's own `name:docker://image` or `name:host` syntax                  |
| `capacity`                  | How many jobs run at once                                                                         |
| `emulation`                 | Whether to also advertise the other CPU architecture                                              |

The model **strips keys it does not declare**, and nothing else writes the file. Everything reaches the runner as environment on each start, so there is no configuration file on disk to inspect or correct — including the connection to Forgejo, whose address is resolved rather than stored.

`USER` is set to the unprivileged account the daemon runs as, not left at the container's inherited `root`. The container engine resolves its subordinate UID and GID ranges by `$USER`, and finding none for `root` it falls back to a single-ID mapping — under which any job image carrying a file not owned by root fails to unpack.

The one value the package composes rather than passes through is the label list. With emulation enabled it appends a foreign-architecture label pinned to that platform, so jobs targeting the other architecture are served under the host's emulation layer. The runner process itself always runs natively.

## Dependencies

One, and it is required in the strong sense.

| Dependency | Kind      | Health check | Mounts | Why                                            |
| ---------- | --------- | ------------ | ------ | ---------------------------------------------- |
| Forgejo    | `running` | `primary`    | none   | The forge this runner registers with and polls |

The health check is required as well as "running", because the runner talks to Forgejo's HTTP API — a Forgejo that is up but not yet serving is no use to it.

**This runner only ever serves the Forgejo on this device.** The address is resolved from Forgejo's own binding over the service bridge; there is no field for a remote forge. If Forgejo is not reachable, `main` refuses to start with a message saying so rather than starting a runner that cannot register.

## Network Access and Interfaces

None. The runner dials out to its forge and pulls job images; it accepts no inbound connections and exports nothing.

## Installation and First-Run Flow

Install seeds the store with defaults and nothing else. There is no task, and the service starts — but it will not do any work until you connect it.

Two gates apply before that, both enforced rather than advisory:

1. **Hardware.** `main` refuses to start on a device below 2 CPU cores or roughly a 4 GB machine's worth of memory, because every job is a full build. The message says so explicitly rather than failing obscurely later.
2. **Forgejo.** It must be installed and serving.

Then run [Configure](#actions) with the UUID and token Forgejo shows under **Settings → Actions → Runners → Create new Runner**, and restart. Until then the runner's health check reports a failure telling you to do exactly that.

## Actions

One action.

### Configure

Connects the runner to Forgejo and sets how it advertises itself.

- **What it changes:** every field in `store.json` — the credentials, labels, concurrency, and the emulation toggle.
- **Cost:** the write is instant, but **it does not apply until the service restarts.** The action says so in its result rather than restarting for you.
- **Repeat safety:** idempotent; the form is pre-filled with the current values and replaces them wholesale.
- **Input notes:** labels use the runner's own syntax. Do not add architecture labels by hand for foreign-architecture jobs — the emulation toggle exists to append the correct pinned label, and a hand-written one will not carry the platform pin.

## Tasks

None. This package raises no tasks, so the service is never held on a prompt and its ordinary controls are always available.

## Health Checks

One check, and it reports configuration rather than liveness.

| Check              | Method                                      | Grace Period |
| ------------------ | ------------------------------------------- | ------------ |
| `primary` "Runner" | Whether both the UUID and the token are set | 60 seconds   |

It polls slowly, because the thing it reports changes only when you change it. A failure here means the runner has not been given credentials — it names the action to run. A pass means the runner is configured; whether Forgejo is currently handing it jobs is visible in Forgejo, not here.

## Backups and Restore

The `main` volume is copied wholesale — `sdk.Backups.ofVolumes('main')`. No dump step and nothing excluded.

- **Included:** the runner's credentials and configuration, and its working directory.
- **Restore:** the runner comes back configured against the same UUID and token. Whether Forgejo still recognises them depends on Forgejo's own state, which is that package's backup rather than this one's — if the forge was rebuilt, register the runner again.

## Limitations and Differences

1. **Only the Forgejo on this device.** There is no field for a remote forge; the address is resolved from the local dependency.
2. **Configuration applies on restart**, not immediately.
3. **The service refuses to start on small hardware** — under 2 cores or roughly a 4 GB machine.
4. **Emulated jobs are much slower than native.** The toggle exists for occasional cross-architecture work; a native runner per architecture is the better arrangement for regular builds.
5. **Jobs run in a rootless engine inside the service**, which requires the two device grants named above, and on StartOS 0.4.0.1 and earlier a startup step to make those device nodes readable by the unprivileged user.
6. **No riscv64 build.** x86_64 and aarch64 only.

---

## Quick Reference for AI Consumers

```yaml
package_id: forgejo-runner
image: ./Dockerfile # upstream's runner binary plus rootless Podman on Debian
architectures:
  - x86_64
  - aarch64
subcontainers:
  - forgejo-runner-sub
volumes:
  main: /data
file_models:
  - store.json
startos_managed_env_vars:
  - INSTANCE_URL
  - RUNNER_UUID
  - RUNNER_TOKEN
  - RUNNER_LABELS
  - RUNNER_CAPACITY
  - XDG_RUNTIME_DIR
  - USER
dependencies:
  - forgejo # required; gated on its primary health check
interfaces: {} # none; the runner accepts no inbound connections
actions:
  - configure
tasks: []
health_checks:
  - primary # displayed "Runner"; reports whether credentials are set
```
