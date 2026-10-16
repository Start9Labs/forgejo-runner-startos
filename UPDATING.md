# Updating

## Forgejo Runner

- **Determining the upstream version:** releases at <https://code.forgejo.org/forgejo/runner/releases>. The `upstream/` submodule pins the source revision. The package builds that source with the patches in `patches/`; it does not copy the published runner binary.
- **Applying the bump:**
  1. Fetch upstream tags and check out the intended release in `upstream/`. Stage the gitlink in the package repository; do not commit packaging changes inside the submodule.
  2. Check each patch's retirement condition. Remove a patch only after verifying that upstream provides its equivalent behavior and regression coverage. Confirm remaining patches apply cleanly.
  3. Match the Go builder in `Dockerfile` to upstream's `go.mod` toolchain, and update the version embedded by its build command.
  4. Update `startos/versions/current.ts` and release notes as the packaging guide specifies.
  5. Run the action-source boundary tests and Docker backend tests, then exercise an ordinary remote action and a Docker action against the packaged runner. Verify both package architectures.

The Docker build runs focused action tests and Docker backend tests. The broader upstream runner suite includes a test requiring a live Docker daemon; a daemon-free builder cannot establish that suite passed.

## Guest image and firmware

`assets/guest-images.json` owns the Debian cloud image release, architecture-specific SHA512 checksums and helper-image digest. Use the dated directories and published `SHA512SUMS` at its Debian `baseUrl`; never replace the dated pin with `latest`. Verify the downloaded bytes for each architecture. Guest firmware comes from Debian's `qemu-efi-aarch64` package in the runtime image.

The prepared cache fingerprint includes the image metadata, host architecture, cloud-init template and preparation/VM helpers. Provisioning changes rebuild the cache at the next virtualized start. To refresh guest packages without changing the cloud release, make the preparation input change explicit rather than mutating a cached disk by hand.

Verify a first preparation, a cache-hit restart, distinct consecutive guest boots, and a job that uses a foreign-architecture image. An ARM64 firmware boot under TCG validates image/firmware wiring, not native ARM64 KVM execution; report that distinction when native hardware is unavailable. The production launcher always requests KVM and never falls back to TCG.

## User-mode QEMU

The `binfmt` build stage pins `tonistiigi/binfmt` by multi-architecture index digest. To refresh it alongside a package update, inspect `docker buildx imagetools inspect tonistiigi/binfmt:latest`, verify x86_64 and aarch64 manifests, and replace the digest in `Dockerfile`. Verify a foreign-architecture container and an emulated image build on StartOS; a successful registration command alone does not prove the interpreter remains registered after that process exits.
