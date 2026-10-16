# Updating

## Forgejo Runner

- **Determining the upstream version:** latest release at <https://code.forgejo.org/forgejo/runner/releases>. The runner binary is **not** downloaded as a release asset — it is copied out of the official multi-arch image, so what matters is that the matching **image tag** exists at `code.forgejo.org/forgejo/runner`. The current pin lives in `Dockerfile`, on the first-stage `FROM` line (`FROM code.forgejo.org/forgejo/runner:<version> AS runner`); a later `COPY --from=runner /bin/forgejo-runner /usr/local/bin/forgejo-runner` pulls the binary into the Debian runtime stage. There is no `ARG`/`RUNNER_VERSION` variable.

  Confirm the image tag is actually published before pinning it (a release does not guarantee an image):

  ```sh
  docker manifest inspect code.forgejo.org/forgejo/runner:<version>
  ```

- **Applying the bump:**
  1. `Dockerfile` — set the tag on `FROM code.forgejo.org/forgejo/runner:<version> AS runner` (no leading `v`).
  2. `startos/versions/current.ts` — set `version: '<version>:0'`, or bump only the `:N` suffix if just the packaging changed. Update the release notes.

## Bundled QEMU

The `binfmt` build stage pins `tonistiigi/binfmt` by multi-architecture index digest. To refresh it alongside a package update, inspect `docker buildx imagetools inspect tonistiigi/binfmt:latest`, verify x86_64 and aarch64 manifests, and replace the digest in `Dockerfile`. Verify a foreign-architecture container and an emulated image build on StartOS; a successful registration command alone does not prove the interpreter remains registered after that process exits.
