#!/bin/bash
# Orchestrates a rootless Podman engine + the Forgejo Runner inside the service
# container. main.ts passes the forge connection via the environment.
set -euo pipefail

: "${INSTANCE_URL:=}"
: "${RUNNER_TOKEN:=}"
: "${RUNNER_NAME:=startos-runner}"
: "${RUNNER_LABELS:=}"

# App-owned working area (chowned by the own-data oneshot); StartOS's own
# store.json stays at /data and is left untouched.
DATA=/data/runner
CONFIG="$DATA/config.yaml"
# `register` writes its state file (.runner) into the working directory.
cd "$DATA"

# Podman needs a writable XDG_RUNTIME_DIR for its socket + transient state.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/data/runner/run}"
mkdir -p "$XDG_RUNTIME_DIR/podman" "$XDG_RUNTIME_DIR/containers" "$DATA/containers/storage"
chmod 700 "$XDG_RUNTIME_DIR"
SOCK="$XDG_RUNTIME_DIR/podman/podman.sock"

# Bring up the Podman API socket (docker-compatible) the runner drives. Layer
# store lives on the data volume so job images survive restarts;
# --cgroup-manager=cgroupfs because there's no user systemd session here.
podman --root "$DATA/containers/storage" --runroot "$XDG_RUNTIME_DIR/containers" \
       --cgroup-manager=cgroupfs system service -t 0 "unix://$SOCK" &
export DOCKER_HOST="unix://$SOCK"

# Wait until the Podman API actually answers — not just the socket file
# appearing — so the runner daemon doesn't race a half-up socket.
for _ in $(seq 1 60); do
  podman --remote --url "unix://$SOCK" info >/dev/null 2>&1 && break
  sleep 1
done

# Default runner config, generated once and kept on the volume.
[ -f "$CONFIG" ] || forgejo-runner generate-config >"$CONFIG"

# Register exactly once; the .runner state file makes this idempotent.
if [ ! -f "$DATA/.runner" ]; then
  if [ -n "$INSTANCE_URL" ] && [ -n "$RUNNER_TOKEN" ]; then
    echo "Registering runner '$RUNNER_NAME' with $INSTANCE_URL ..."
    forgejo-runner register --no-interactive \
      --instance "$INSTANCE_URL" --token "$RUNNER_TOKEN" \
      --name "$RUNNER_NAME" --labels "$RUNNER_LABELS" --config "$CONFIG"
  else
    echo "forgejo-runner: not configured. Run the 'Configure' action to set a" \
         "Forgejo URL + registration token, then restart this service." >&2
    # Stay alive so the health check can report 'needs config' instead of crash-looping.
    exec sleep infinity
  fi
fi

exec forgejo-runner daemon --config "$CONFIG"
