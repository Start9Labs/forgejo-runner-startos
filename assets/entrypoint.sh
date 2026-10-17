#!/bin/bash
# main.ts supplies the engine socket and Forgejo connection.
set -euo pipefail

: "${INSTANCE_URL:=}"
: "${RUNNER_UUID:=}"
: "${RUNNER_TOKEN:=}"
: "${RUNNER_LABELS:=}"
: "${RUNNER_CAPACITY:=1}"
: "${RUNNER_CONFIGURE_ACTION:=Configure}"
: "${RUNNER_SCRATCH_DIR:?}"
: "${RUNNER_PRIVILEGED:?}"
case "$RUNNER_PRIVILEGED" in true|false) ;; *) exit 1 ;; esac

# Only this tier's working directory is mounted at /data.
DATA=/data/runner
CONFIG="$DATA/config.yaml"
cd "$DATA"
source /usr/local/libexec/runner-docker-client.sh

# Without credentials the forge connection is incomplete; stay alive so the
# health check can report 'needs config' instead of crash-looping.
if [ -z "$INSTANCE_URL" ] || [ -z "$RUNNER_UUID" ] || [ -z "$RUNNER_TOKEN" ]; then
  echo "forgejo-runner: not configured. Run '$RUNNER_CONFIGURE_ACTION' with the" \
       "runner UUID + token from Forgejo's 'Create new Runner' page, then" \
       "restart this service." >&2
  exec sleep infinity
fi

# Forgejo v12 deprecated `register`; declare the forge connection in config.yaml
# (the multi-connection model) and run the daemon against it. Regenerate the
# config each start so Configure changes always take effect, then inject our
# connection under the (otherwise empty) server.connections map.
forgejo-runner generate-config >"$CONFIG"
sed -i \
  -e "s/^  capacity: .*/  capacity: ${RUNNER_CAPACITY}/" \
  -e "s/^  privileged: false$/  privileged: ${RUNNER_PRIVILEGED}/" \
  -e 's/^  env_file: .*/  env_file: ""/' \
  "$CONFIG"
if [ -n "${RUNNER_BEFORE_JOB:-}" ]; then
  command=$(jq -nc --arg executable "$RUNNER_BEFORE_JOB" '[$executable]')
  sed -i "/^runner:$/a\\  before_job: $command" "$CONFIG"
fi
if [ "$RUNNER_PRIVILEGED" = true ]; then
  RESOLV_CONF=/etc/resolv.conf
  SOCKET_OPTION=
  SOCKET_VOLUME=
  HOST_OPTIONS=$(jq -er 'if type != "array" or any(.[]; type != "string" or (test("^[A-Za-z0-9][A-Za-z0-9.-]*:[0-9.]+$") | not)) then error("Invalid local host mapping") else map(" --add-host " + .) | join("") end' <<< "${RUNNER_LOCAL_HOSTS:-[]}")
  ENGINE_ENDPOINT=automount
  if [[ "$DOCKER_HOST" = tcp://* ]]; then
    ENGINE_ENDPOINT=$DOCKER_HOST
    SOCKET_OPTION=' --volume /var/run/docker.sock:/var/run/docker.sock'
    SOCKET_VOLUME=', "/var/run/docker.sock"'
    sed -i -e 's/^  enabled: true$/  enabled: false/' "$CONFIG"
  fi
  sed -i \
    -e "s|^  docker_host: \"-\"$|  docker_host: \"${ENGINE_ENDPOINT}\"|" \
    -e "s|^  options:$|  options: \"--volume ${RUNNER_SCRATCH_DIR}:/root/setup-docker-action --volume ${RESOLV_CONF}:${RESOLV_CONF}:ro${SOCKET_OPTION}${HOST_OPTIONS}\"|" \
    -e "s|^  valid_volumes: \[\]$|  valid_volumes: [\"${RUNNER_SCRATCH_DIR}\", \"${RESOLV_CONF}\"${SOCKET_VOLUME}]|" \
    "$CONFIG"
fi
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

wait_for_registration() {
  echo "forgejo-runner: Forgejo no longer recognizes this runner. Create a new" \
       "runner in Forgejo, enter its UUID and token in '$RUNNER_CONFIGURE_ACTION', then restart." >&2
  exec sleep infinity
}

REJECTED="$DATA/rejected-uuid"
if [ "$(cat "$REJECTED" 2>/dev/null)" = "$RUNNER_UUID" ]; then
  wait_for_registration
fi
rm -f "$REJECTED"

LOG="$DATA/run/daemon.log"
exec 3> >(tee "$LOG")
tee_pid=$!
if [ "$#" -eq 0 ]; then set -- daemon; fi
forgejo-runner "$@" --config "$CONFIG" >&3 2>&1 &
pid=$!
exec 3>&-
trap 'kill -TERM "$pid" 2>/dev/null' TERM INT
status=0
wait "$pid" || status=$?
while kill -0 "$pid" 2>/dev/null; do status=0; wait "$pid" || status=$?; done
wait "$tee_pid" || true

# Forgejo answers "unregistered runner" once its database no longer holds this UUID.
if grep -qE '^Error: ([a-z_]+: )?unregistered runner$' "$LOG"; then
  printf '%s' "$RUNNER_UUID" >"$REJECTED"
  wait_for_registration
fi
exit "$status"
