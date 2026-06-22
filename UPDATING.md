# Updating

## Forgejo Runner

- **Determining the upstream version:** latest release at <https://code.forgejo.org/forgejo/runner/releases>. Binary assets are named `forgejo-runner-<version>-linux-amd64` / `-arm64`. The current pin lives in `Dockerfile` (`ARG RUNNER_VERSION`).
- **Applying the bump:**
  1. `Dockerfile` — set `ARG RUNNER_VERSION=<version>` (no leading `v`).
  2. `startos/versions/current.ts` — set `version: '<version>:0'`, or bump only the `:N` suffix if just the packaging changed. Update the release notes.
