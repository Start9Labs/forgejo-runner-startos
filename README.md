<p align="center">
  <img src="icon.svg" alt="Forgejo Runner Logo" width="21%">
</p>

# Forgejo Runner on StartOS

> Everything not listed in this document should behave the same as upstream
> Forgejo Runner. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

[Forgejo Runner](https://code.forgejo.org/forgejo/runner) executes workflows for the Forgejo on this device. This package supplies an unprivileged runner and an optional privileged build runner in one StartOS service.

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

A custom Debian image combines the upstream runner, Docker CE, fuse-overlayfs, git, and digest-pinned static QEMU interpreters. It runs natively on x86_64 and aarch64.

| Subcontainer | Purpose |
| --- | --- |
| `forgejo-runner-sub` | Default runner and its Docker engine |
| `forgejo-build-runner-sub` | Optional build runner and its separate Docker engine |

Each engine runs as root inside the service user namespace; its runner process runs as `app`. Docker uses fuse-overlayfs and the `runc-nested` wrapper, which removes the sysctl that cannot reliably be reopened across the StartOS namespace boundary. The engine entrypoint retains a private binfmt mount for QEMU registration. Both runners share the service's user and network namespaces; separate SDK subcontainers do not create separate service LXCs.

The default job policy disables privileged mode, engine-socket mounting, and host-volume access. The build policy enables privileged jobs and exposes only its own engine socket and build scratch. Neither policy accepts host-backend labels. Configuration also rejects reused registration UUIDs and duplicate or overlapping advertised label names, including emulation labels. Label-name comparisons ignore case.

Each engine has a distinct bridge and address pool. Both engines must be ready before either runner starts polling, preventing a second engine's initialization from interrupting an already-dispatched job. Saving either configuration restarts the entire daemon chain.

## Volume and Data Layout

The control-plane store stays outside both engine mounts. Each subcontainer sees only its own state and cache subtree.

| Volume path | Visible inside its tier's subcontainer | Purpose |
| --- | --- | --- |
| `main/store.json` | Not mounted into either engine | Authoritative settings for both registrations |
| `main/unprivileged/` | `/data` in the default subcontainer | Generated configuration, logs, and rejection marker |
| `main/build/` | `/data` in the build subcontainer | Separate generated configuration, logs, and rejection marker |
| `scratch/unprivileged/` | `/scratch` in the default subcontainer | Default engine image/layer storage |
| `scratch/build/` | `/scratch` in the build subcontainer | Build engine image/layer storage and nested build scratch |

Within either tier, `/data/runner/run` contains transient sockets and PID files and is recreated at startup. Only `/data/runner` is chowned; layer ownership is never recursively rewritten.

Build jobs bind `/scratch/jobs` at `/root/setup-docker-action`, keeping a nested daemon's storage off the job's layered root filesystem. They also receive the engine's resolver file read-only so nested Docker can inherit StartOS DNS rather than falling back from an embedded loopback resolver. Default jobs receive neither bind mount. A workflow selecting another nested-daemon runtime directory needs an equivalent build-scratch arrangement. Interrupted jobs can leave disposable scratch data.

## File Models

The package owns a JSON settings file and a rejection marker per tier. Defaults are repaired during initialization without stripping unmodeled keys.

`store.json` retains the default runner's top-level `runnerUuid`, `runnerToken`, `labels`, `capacity`, and `emulation`. `buildRunner` contains the same fields plus `enabled`, which defaults to false. Only configuration actions write these settings.

The entrypoint regenerates `/data/runner/config.yaml` in each subcontainer on every start. It is useful for diagnosis but hand edits do not survive a restart. Connection addresses and immutable privilege policy come from the package, not from editable upstream configuration.

`unprivileged/runner/rejected-uuid` and `build/runner/rejected-uuid` record a registration rejected by Forgejo. They are independent: rejection in one tier does not mark the other's credentials invalid.

## Dependencies

Forgejo is required, running, healthy on its primary check, and has Actions enabled. Neither runner mounts Forgejo's data.

Both connect through Forgejo's resolved service-bridge address; remote Forgejo instances are not configurable. The package raises a dependency task when Actions is disabled.

## Network Access and Interfaces

There are no user-facing interfaces. Both runners dial Forgejo and fetch images/actions outbound; their engine APIs are Unix sockets, not TCP listeners.

The default engine uses bridge `runner-default` at `172.18.0.1/24` with job networks from `172.20.0.0/16`. The build engine uses `runner-build` at `172.19.0.1/24` with job networks from `172.21.0.0/16`. These share the outer service network namespace and must not overlap networks the workflows need to reach.

## Installation and First-Run Flow

Initialization seeds the default runner settings and leaves the build runner disabled. A critical configuration task blocks startup until the default registration is present.

The hardware gate requires at least two CPU cores and a machine in the four-gigabyte memory class. Enabling the build runner adds a second engine and shares the same CPU and memory budget; it does not allocate another VM or service container.

## Actions

The two configuration actions update independent sections of `store.json`, but either change restarts both runners and can interrupt active jobs. Saving the same settings is safe to repeat.

**Configure** changes the default registration and its labels, concurrency, and emulation. **Configure Build Runner** changes the optional registration, its enabled state, and its job settings. Disabling it stops its runner and engine without deleting their retained state or credentials. Credentials can be left blank while it is disabled; enabling it requires both.

Validation rejects host labels, duplicate registration UUIDs, and label collisions. These checks prevent accidental routing ambiguity; Forgejo registration scope remains the authority for which repositories may dispatch privileged work. The package cannot turn a pasted site-wide registration into a repository-scoped one.

## Tasks

Configuration tasks are critical and therefore gate the whole service, not just one runner. Disabling the build runner leaves the default runner's setup requirement in place.

- **Configure:** raised when the default credentials are missing or its labels are invalid. Correcting that configuration clears it.
- **Configure Build Runner:** raised when an enabled build runner has incomplete or conflicting configuration. Correcting it or disabling the build runner clears it.
- **Forgejo Configure:** raised on the dependency while Actions is disabled, and cleared by enabling Actions there.

## Health Checks

Each enabled runner has its own process/engine check, with a sixty-second grace period and thirty-second checks. Hidden engine readiness checks gate startup first.

`primary` reports the default runner; `build-runner` reports the optional build runner. A successful check requires a live runner process and a responding engine in that tier's subcontainer. Inspect the named subcontainer when either fails rather than assuming the other engine is involved.

A matching rejection marker means Forgejo has forgotten that registration. The entrypoint records the UUID and waits instead of crash-looping. Saving a different UUID lets that tier reconnect; use its corresponding configuration action. Disabled build runners have no running daemon or health check.

## Backups and Restore

Backups copy `main` wholesale, including the central settings and both tiers' state. The entire `scratch` volume is excluded because images and build intermediates can be reconstructed.

A restore reconnects both configured registrations if Forgejo still recognizes them. Engine caches are repulled. If Forgejo's database no longer has a registration, that tier needs replacement credentials.

## Limitations and Differences

1. This remains **one StartOS service boundary**. Separate engines and filesystem mounts reduce accidental sharing; they are not VM-grade or separate-LXC isolation for mutually hostile tenants.
2. Privileged jobs control the build engine, its containers, and its mounted data. Restrict that registration through Forgejo; a workflow label is not authorization.
3. Host execution labels are unsupported in both tiers, and tier labels must be distinct.
4. Both runners restart when either configuration changes. Their resource and outer network/user namespaces are shared.
5. Foreign-architecture jobs run more slowly under emulation. The package itself runs natively only on x86_64 and aarch64.
6. Scratch caches consume persistent disk space even though they are excluded from backups; disabled or interrupted builds can leave cached data.

## Quick Reference for AI Consumers

```yaml
package_id: forgejo-runner
image: ./Dockerfile
architectures: [x86_64, aarch64]
subcontainers: [forgejo-runner-sub, forgejo-build-runner-sub]
volumes:
  main: /data # tier-specific subtrees only; central store remains outside engine mounts
  scratch: /scratch # tier-specific subtrees, excluded from backups
file_models:
  - store.json
  - unprivileged/runner/rejected-uuid
  - build/runner/rejected-uuid
startos_managed_env_vars:
  - INSTANCE_URL
  - RUNNER_UUID
  - RUNNER_TOKEN
  - RUNNER_LABELS
  - RUNNER_CAPACITY
  - RUNNER_PRIVILEGED
  - RUNNER_CONFIGURE_ACTION
  - RUNNER_SCRATCH_DIR
  - DOCKER_HOST
  - BINFMT_DIR
  - RUNNER_BRIDGE
  - RUNNER_BRIDGE_ADDRESS
dependencies: [forgejo]
interfaces: {}
actions: [configure, configure-build]
tasks:
  - { action: configure, severity: critical }
  - { action: configure-build, severity: critical }
  - { package: forgejo, action: configure, severity: critical }
health_checks: [primary, build-runner]
```
