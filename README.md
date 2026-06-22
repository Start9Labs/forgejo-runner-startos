# Forgejo Runner for StartOS

Runs [Forgejo Actions](https://forgejo.org/docs/latest/admin/actions/) CI/CD jobs for the **Forgejo instance on this device** — a hard dependency.

## How this package works

- **Rootless nested OCI.** Each job runs in its own container via a rootless **Podman** engine inside the service (manifest `userspaceFilesystems` + `virtualNetworking`; see the packaging guide's "Run a Nested OCI Runtime" recipe). No privileged Docker-in-Docker, and untrusted job code is isolated from the host and from your repos.
- **Multi-arch via host emulation.** StartOS registers QEMU `binfmt` handlers (fix-binary flag) host-wide at boot, so a job targeting a foreign architecture (`arm64`, `riscv64`, …) runs under emulation automatically — no per-container setup. Emulated builds are much slower; prefer a native runner per architecture.
- **Outbound only.** The runner dials its Forgejo and long-polls for jobs; it exposes no inbound interface.
- **Registration.** On start, an entrypoint brings up the rootless Podman socket, wires `DOCKER_HOST` to it, then registers once (idempotent via the `.runner` state file) against the local Forgejo (`forgejo.startos`) with the token from the Configure action, and runs `forgejo-runner daemon`.

## Scope

This runner serves **only** the Forgejo on the same device (a required dependency). A box that wants its own CI runs its own runner; there is no remote-forge mode. (Start9's cross-machine / multi-arch CI fleet is handled by server-side infrastructure, not this package.)

## Differences from upstream

- Upstream `forgejo-runner` expects you to provide a Docker/Podman socket; this package bundles rootless Podman and wires `DOCKER_HOST` automatically. The runner binary is copied from the official `code.forgejo.org/forgejo/runner` image.
- Configuration is via the **Configure** action (persisted to `store.json`) rather than a hand-edited `config.yaml`; a default `config.yaml` is generated on first start.
- A resource floor (2 GiB RAM, 2 CPU cores) is enforced before the runner starts.

## Build

`npm ci && make` (or `make x86` for a single arch). See `UPDATING.md` for bumping the runner version.

Upstream: <https://code.forgejo.org/forgejo/runner>
