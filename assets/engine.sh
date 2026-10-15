#!/bin/sh
set -eu
: "${BINFMT_DIR:?}"
mkdir -p "$BINFMT_DIR"
# The helper unmounts filesystems it creates, discarding their registrations.
mount -t binfmt_misc binfmt_misc "$BINFMT_DIR"
QEMU_PRESERVE_ARGV0=1 /usr/bin/binfmt --mount "$BINFMT_DIR" --install all
exec dockerd "$@"
