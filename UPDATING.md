# Updating

## Forgejo Runner

- **Determining the upstream version:** releases at <https://code.forgejo.org/forgejo/runner/releases>. The `upstream/` submodule pins the source revision. The package builds that source with the patches in `patches/`; it does not copy the published runner binary.
- **Applying the bump:**
  1. Fetch upstream tags and check out the intended release in `upstream/`. Stage the gitlink in the package repository; do not commit packaging changes inside the submodule.
  2. Check each patch's retirement condition. Remove a patch only after verifying that upstream provides its equivalent behavior and regression coverage. Confirm remaining patches apply cleanly.
  3. Match the Go builder in `Dockerfile` to upstream's `go.mod` toolchain, and update the version embedded by its build command.

## Guest image and firmware

`runtime/assets/guest-images.json` owns the Debian cloud image release, architecture-specific SHA512 checksums and helper-image digest. Use the dated directories and published `SHA512SUMS` at its Debian `baseUrl`; never replace the dated pin with `latest`. Verify the downloaded bytes for each architecture. Guest firmware comes from Debian's `qemu-efi-aarch64` package in the runtime image. To refresh guest packages without changing the cloud release, make the preparation input change explicit rather than mutating a cached disk by hand.

## User-mode QEMU

The `binfmt` build stage pins `tonistiigi/binfmt` by multi-architecture index digest. To refresh it alongside a package update, inspect `docker buildx imagetools inspect tonistiigi/binfmt:latest`, verify x86_64 and aarch64 manifests, and replace `BINFMT_IMAGE` in `runtime/index.ts`.
