<p align="center">
  <img src="icon.svg" alt="Forgejo Runner Logo" width="21%">
</p>

# Forgejo Runner on StartOS

> **Upstream docs:** <https://forgejo.org/docs/latest/admin/actions/>
>
> Everything not listed in this document behaves identically to upstream Forgejo Runner. If a feature, setting, or behavior is not mentioned here, the upstream documentation is accurate and fully applicable.

[Forgejo Runner](https://code.forgejo.org/forgejo/runner) executes Forgejo Actions (CI/CD) workflows. This repository packages it for [StartOS](https://github.com/Start9Labs/start-os/), where it runs each job inside a rootless, nested OCI sandbox and serves the Forgejo instance installed on the same device.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Configuration Management](#configuration-management)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Actions (StartOS UI)](#actions-startos-ui)
- [Job Execution and Multi-Arch](#job-execution-and-multi-arch)
- [Backups and Restore](#backups-and-restore)
- [Health Checks](#health-checks)
- [Dependencies](#dependencies)
- [Limitations and Differences](#limitations-and-differences)
- [What Is Unchanged from Upstream](#what-is-unchanged-from-upstream)
- [Contributing](#contributing)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

| Aspect        | Standard install                                                   | StartOS                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image         | The `forgejo-runner` binary plus a Docker/Podman socket you supply | Custom image: Debian + rootless **Podman** and **git** (used to fetch `uses:` actions), with the `forgejo-runner` binary copied from the official `code.forgejo.org/forgejo/runner` image |
| Architectures | depends on host                                                    | x86_64, aarch64                                                                                                                                                                           |
| Job engine    | an external Docker/Podman daemon you wire up                       | a rootless Podman engine bundled inside the service (`userspaceFilesystems` + `virtualNetworking`)                                                                                                                   |
| Entrypoint    | `forgejo-runner daemon`                                            | a wrapper that starts the Podman socket, declares the forge connection in `config.yaml` (the v12 connection model), then runs `forgejo-runner daemon`                                     |

Upstream expects you to provide a container engine; this package bundles a rootless Podman engine so each CI job is sandboxed without privileged Docker-in-Docker.

## Volume and Data Layout

| Aspect              | StartOS                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary volume      | Single managed volume `main`, mounted at `/data`                                                                                                    |
| Runner working area | `/data/runner` — the generated `config.yaml` (carrying the declared forge connection) and the Podman layer store (so job images survive restarts)   |
| StartOS settings    | `/data/store.json` — runner UUID + token, labels, concurrency, and the emulation toggle (see [Configuration Management](#configuration-management)) |

## Installation and First-Run Flow

The runner does nothing until it is connected to a Forgejo instance.

1. On start, the entrypoint brings up the rootless Podman socket.
2. If no runner UUID + token are configured, the service stays up but idle and prompts you to run **Configure**.
3. Once configured, it writes the forge connection into `config.yaml` and runs the runner daemon, which long-polls Forgejo for jobs.

## Configuration Management

Forgejo v12 deprecated the `forgejo-runner register` command in favor of the **connection model**: a runner is created in Forgejo (which issues a UUID + token), and those credentials are declared in `config.yaml` under `server.connections`. On StartOS you supply them through the **Configure** action; values persist in `store.json` and are written into the generated `config.yaml` on each start.

| Setting          | Managed via                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Runner UUID      | "Configure" action — from Forgejo's _Create new Runner_ page                                                          |
| Runner token     | "Configure" action — issued alongside the UUID                                                                        |
| Labels           | "Configure" action — written into the `config.yaml` connection                                                        |
| Concurrent jobs  | "Configure" action — sets `runner.capacity`                                                                           |
| Enable Emulation | "Configure" action — appends a foreign-arch label (see [Job Execution and Multi-Arch](#job-execution-and-multi-arch)) |
| Forge URL        | Resolved automatically to the local Forgejo's HTTP binding over the internal LXC bridge                               |

## Network Access and Interfaces

**None.** The runner makes only outbound connections — it long-polls Forgejo for jobs and pulls job images — and exposes no inbound interface. View its status and job logs inside Forgejo (its Runners list and the Actions tab), plus the StartOS service logs.

## Actions (StartOS UI)

| Action    | Visibility | Availability | Purpose                                                         |
| --------- | ---------- | ------------ | --------------------------------------------------------------- |
| Configure | Visible    | Any          | Set the runner UUID + token, labels, concurrency, and emulation |

### Configure

- **Inputs:** Runner UUID (required), runner token (required), labels, concurrent jobs, Enable Emulation
- **Outputs:** None — restart the service to apply
- The UUID + token come from Forgejo's _Create new Runner_ page and are durable credentials (unlike the old single-use registration token); saving simply rewrites the connection and restarts pick it up.

## Job Execution and Multi-Arch

Each job runs in its own container via the bundled rootless Podman engine. StartOS registers QEMU `binfmt` handlers host-wide, so foreign-architecture container images run under emulation automatically — a job that does its own `docker buildx --platform linux/arm64` needs no extra setup.

The runner image ships `git`, which the daemon shells out to when fetching `uses:` actions (such as `actions/checkout`); without it every `uses:` step would fail at the action fetch. The first job for a given image tag also pulls that image (~1 GB for the default `ubuntu-latest`), so its initial **Set up job** step can take a minute or two before the image is cached locally.

To make this runner accept **whole** foreign-architecture jobs, turn on **Enable Emulation** in Configure. It advertises an extra label for the other CPU architecture, pinned to that platform via forgejo-runner's `?platform=` label option, so jobs targeting it run under emulation. Emulated builds are much slower than native; for regular multi-arch work, prefer a native runner per architecture and reserve emulation for architectures you have no native hardware for.

## Backups and Restore

| Aspect  | StartOS                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| Scope   | Full `/data` volume — `store.json`, the runner config, and cached job images                                |
| Restore | The volume is fully restored before the service starts; the runner reconnects using its declared connection |

## Health Checks

| Aspect       | StartOS                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Method       | Reflects configuration state, displayed as "Runner"                                             |
| Grace period | 60 seconds                                                                                      |
| Behavior     | Healthy once the runner UUID + token are configured; otherwise prompts you to run **Configure** |

## Dependencies

| Dependency  | Required?          | Purpose                                                                                                                                            |
| ----------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Forgejo** | Required (running) | The forge this runner serves. The runner connects and long-polls over Forgejo's HTTP API, so Forgejo's web-interface health check must be passing. |

This runner serves only the Forgejo on the same device — there is no remote-forge mode.

## Limitations and Differences

1. **Local forge only** — connects to the Forgejo on this device; there is no remote-instance option.
2. **No inbound interface** — outbound-only; status and logs are viewed in Forgejo, not in a runner UI.
3. **Connection model, not `register`** — you provide the UUID + token from Forgejo's _Create new Runner_ page; the deprecated `register` command is not used.
4. **Emulated foreign-arch jobs are slow** — a native runner per architecture is preferred for regular multi-arch builds.

## What Is Unchanged from Upstream

Everything not listed above behaves as documented at <https://forgejo.org/docs/latest/admin/actions/> — workflow syntax, the `daemon` behavior, label matching, and job execution semantics.

## Contributing

Build and development workflow follow the StartOS packaging guide: <https://docs.start9.com/packaging>. Keep `README.md`, `instructions.md`, and `AGENTS.md` in sync with any change to user-visible behavior or package structure.

---

## Quick Reference for AI Consumers

```yaml
package_id: forgejo-runner
image: custom (Debian + rootless Podman + git + forgejo-runner)
architectures: [x86_64, aarch64]
volumes:
  main: /data
ports: none
dependencies:
  - forgejo (required, running)
registration: connection model (server.connections in config.yaml; register is deprecated)
startos_managed_env_vars:
  - INSTANCE_URL
  - RUNNER_UUID
  - RUNNER_TOKEN
  - RUNNER_LABELS
  - RUNNER_CAPACITY
  - XDG_RUNTIME_DIR
  - USER
actions:
  - configure
```
