#!/bin/bash
# Orchestrates a rootless Podman engine + the Forgejo Runner inside the service
# container. main.ts passes the forge connection via the environment.
set -euo pipefail

: "${INSTANCE_URL:=}"
: "${RUNNER_UUID:=}"
: "${RUNNER_TOKEN:=}"
: "${RUNNER_LABELS:=}"
: "${RUNNER_CAPACITY:=1}"

# App-owned working area (chowned by the own-data oneshot); StartOS's own
# store.json stays at /data and is left untouched.
DATA=/data/runner
CONFIG="$DATA/config.yaml"
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

# Without credentials the forge connection is incomplete; stay alive so the
# health check can report 'needs config' instead of crash-looping.
if [ -z "$INSTANCE_URL" ] || [ -z "$RUNNER_UUID" ] || [ -z "$RUNNER_TOKEN" ]; then
  echo "forgejo-runner: not configured. Run the 'Configure' action with the" \
       "runner UUID + token from Forgejo's 'Create new Runner' page, then" \
       "restart this service." >&2
  exec sleep infinity
fi

# Forgejo v12 deprecated `register`; declare the forge connection in config.yaml
# (the multi-connection model) and run the daemon against it. Regenerate the
# config each start so Configure changes always take effect, then inject our
# connection under the (otherwise empty) server.connections map.
forgejo-runner generate-config >"$CONFIG"
sed -i "s/^  capacity: .*/  capacity: ${RUNNER_CAPACITY}/" "$CONFIG"
awk -v url="$INSTANCE_URL" -v uuid="$RUNNER_UUID" -v token="$RUNNER_TOKEN" -v labels="$RUNNER_LABELS" '
  { print }
  /^  connections:[[:space:]]*$/ && !done {
    print "    forgejo:"
    print "      url: \"" url "\""
    print "      uuid: \"" uuid "\""
    print "      token: \"" token "\""
    if (labels != "") {
      print "      labels:"
      n = split(labels, a, ",")
      for (i = 1; i <= n; i++) if (a[i] != "") print "        - \"" a[i] "\""
    }
    done = 1
  }
' "$CONFIG" >"$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"

exec forgejo-runner daemon --config "$CONFIG"
