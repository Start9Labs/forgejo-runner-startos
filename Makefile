# overrides to s9pk.mk must precede the include statement
# The forgejo-runner binary ships only x86_64 + aarch64 (no riscv64), so skip
# riscv. Foreign-arch jobs use namespace-local QEMU; this list governs only
# the architectures the runner package itself runs on.
ARCHES := x86 arm
include node_modules/@start9labs/start-sdk/s9pk.mk

javascript/index.js: $(shell find runtime -name '*.ts')
