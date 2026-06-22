# overrides to s9pk.mk must precede the include statement
# The forgejo-runner binary ships only x86_64 + aarch64 (no riscv64), so skip
# riscv. (Foreign-arch *jobs* are still built via the host's qemu binfmt; this
# is only about which arches the runner package itself runs on.)
ARCHES := x86 arm
include s9pk.mk
