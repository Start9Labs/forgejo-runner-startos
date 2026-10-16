#!/bin/sh
set -eu
: "${BINFMT_DIR:?}"
mkdir -p "$BINFMT_DIR"
# The helper unmounts filesystems it creates, discarding their registrations.
mount -t binfmt_misc binfmt_misc "$BINFMT_DIR"
QEMU_PRESERVE_ARGV0=1 /usr/bin/binfmt --mount "$BINFMT_DIR" --install all
: "${RUNNER_BRIDGE:?}"
: "${RUNNER_BRIDGE_ADDRESS:?}"
if ! ip link show dev "$RUNNER_BRIDGE" >/dev/null 2>&1; then
  ip link add name "$RUNNER_BRIDGE" type bridge
fi
ip address replace "$RUNNER_BRIDGE_ADDRESS" dev "$RUNNER_BRIDGE"
ip link set dev "$RUNNER_BRIDGE" up
exec dockerd "$@"
