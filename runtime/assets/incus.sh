#!/bin/bash
: "${INCUS_CPU_CORES:?}" "${INCUS_MEMORY_GIB:?}" "${INCUS_PROJECT:?}" "${INCUS_NAME_PREFIX:?}" "${INCUS_CONNECTION_ID:?}"
VM_BACKEND_LIB=/usr/local/libexec/runner-incus.sh
VM_DOCKER_LISTEN_ADDRESS=127.0.0.1
source /usr/local/libexec/runner-guest.sh
guest_recover socat
export INCUS_CONF="/incus/$INCUS_CONNECTION_ID" INCUS_PROJECT
INCUS_REMOTE=runner
# Scopes instance and image names to this installation's client identity.
INCUS_OWNER="$INCUS_NAME_PREFIX-$(openssl x509 -in "$INCUS_CONF/client.crt" -noout -fingerprint -sha256 | cut -d= -f2 | tr -d : | tr A-F a-f | cut -c1-8)"

incus_cli() { incus --project "$INCUS_PROJECT" "$@" </dev/null; }
incus_instances() {
  timeout 60 env INCUS_CONF="/incus/${1:-$INCUS_CONNECTION_ID}" incus --project "${2:-$INCUS_PROJECT}" list "$INCUS_REMOTE:" --format json </dev/null
}
# Bounded so an instance that never stops cannot pin its slot.
incus_delete() {
  local name=$1 connection=${2:-$INCUS_CONNECTION_ID} project=${3:-$INCUS_PROJECT} instances
  if timeout 120 env INCUS_CONF="/incus/$connection" incus --project "$project" delete --force "$INCUS_REMOTE:$name" </dev/null; then
    return 0
  fi
  instances=$(incus_instances "$connection" "$project") || return 1
  jq -e --arg name "$name" 'type == "array" and all(.[]; .name != $name)' <<< "$instances" >/dev/null
}
incus_instance_status() { incus query "$INCUS_REMOTE:/1.0/instances/$1?project=$INCUS_PROJECT" </dev/null | jq -r .status; }

incus_launch() {
  local image=$1 user_data=$2 name=$3
  shift 3
  jq -n --arg name "$name" --arg connection "$INCUS_CONNECTION_ID" --arg project "$INCUS_PROJECT" \
    '{name: $name, connectionId: $connection, project: $project}' > /vm/instance.tmp
  mv /vm/instance.tmp /vm/instance
  local -a args=(launch --quiet "$image" "$INCUS_REMOTE:$name" --vm
    -c "cloud-init.user-data=$(cat "$user_data")"
    -c "limits.cpu=$INCUS_CPU_CORES" -c "limits.memory=${INCUS_MEMORY_GIB}GiB" "$@")
  if [ -n "${INCUS_PROFILE:-}" ]; then args+=(--profile "$INCUS_PROFILE"); fi
  if [ -n "${INCUS_STORAGE_POOL:-}" ]; then args+=(--storage "$INCUS_STORAGE_POOL"); fi
  if [ -n "${INCUS_NETWORK:-}" ]; then args+=(--network "$INCUS_NETWORK"); fi
  incus_cli "${args[@]}"
}

incus_tunnel() {
  INCUS_INSTANCE=$(jq -er .name /vm/instance) socat "TCP-LISTEN:$VM_DOCKER_PORT,bind=127.0.0.1,reuseaddr,fork" EXEC:/usr/local/libexec/runner-incus-connect.sh 2>>/vm/tunnel.log &
  guest_record_pid "$!"
}

incus_delete_prefixed() {
  local name instances names
  instances=$(incus_instances) || return 1
  names=$(jq -er 'map(.name) | join("\n")' <<< "$instances") || return 1
  while read -r name; do
    if [[ "$name" == "$1"* ]]; then incus_delete "$name" || return 1; fi
  done <<< "$names"
}

vm_dispose() {
  vm_stop_process
  local name connection project
  if [ -f /vm/instance ]; then
    name=$(jq -er .name /vm/instance) || return 1
    connection=$(jq -er .connectionId /vm/instance) || return 1
    project=$(jq -er .project /vm/instance) || return 1
    if ! incus_delete "$name" "$connection" "$project"; then
      echo "Could not delete Incus instance $name" >&2
      return 1
    fi
    rm -f /vm/instance
  fi
  rm -rf /data/tls /data/user-data /vm/tunnel.log
}

guest_worker_init() {
  : "${INCUS_DISK_GIB:?}" "${VM_SLOT:?}"
  INCUS_SLOT_PREFIX="$INCUS_OWNER-s$VM_SLOT-"
}

guest_worker_wait() { incus_delete_prefixed "$INCUS_SLOT_PREFIX"; }
guest_reserve() { :; }
guest_started() { :; }
guest_release() { :; }

guest_launch() {
  guest_user_data /usr/local/share/runner-guest-cloud-init.yaml /data/user-data
  incus_launch "$INCUS_REMOTE:$(cat /base/incus-image)" /data/user-data "$INCUS_SLOT_PREFIX$(cut -c1-8 /proc/sys/kernel/random/uuid)" \
    --ephemeral --device "root,size=${INCUS_DISK_GIB}GiB"
}

guest_connect() { incus_tunnel; }

guest_image_current() {
  local image
  image=$(jq -r .incusImage /usr/local/share/runner-guest-images.json)
  INCUS_IMAGE_ALIAS="$INCUS_OWNER-$(guest_fingerprint incus "$image" | cut -c1-16)"
  [ "$(cat /cache/incus-image 2>/dev/null)" = "$INCUS_IMAGE_ALIAS" ] && incus_cli image info "$INCUS_REMOTE:$INCUS_IMAGE_ALIAS" >/dev/null 2>&1
}

guest_prepare_launch() {
  incus_delete_prefixed "$INCUS_OWNER-prepare-"
  guest_preparation_user_data /usr/local/share/runner-guest-cloud-init.yaml /data/prepare-user-data
  incus_launch "$(jq -r .incusImage /usr/local/share/runner-guest-images.json)" /data/prepare-user-data "$INCUS_OWNER-prepare-$(cut -c1-8 /proc/sys/kernel/random/uuid)"
  incus_tunnel
}

guest_wait_poweroff() {
  local attempt name
  name=$(jq -er .name /vm/instance)
  vm_stop_process
  for ((attempt=0; attempt<120; attempt++)); do
    if [ "$(incus_instance_status "$name")" = Stopped ]; then return 0; fi
    sleep 1
  done
  echo 'Guest did not power off after image preparation' >&2
  return 1
}

guest_image_publish() {
  local name previous
  name=$(jq -er .name /vm/instance)
  previous=$(cat /cache/incus-image 2>/dev/null || true)
  incus_cli image delete "$INCUS_REMOTE:$INCUS_IMAGE_ALIAS" 2>/dev/null || true
  incus_cli publish --quiet "$INCUS_REMOTE:$name" "$INCUS_REMOTE:" --alias "$INCUS_IMAGE_ALIAS"
  printf '%s' "$INCUS_IMAGE_ALIAS" > /cache/incus-image
  if [ -n "$previous" ] && [ "$previous" != "$INCUS_IMAGE_ALIAS" ]; then
    incus_cli image delete "$INCUS_REMOTE:$previous" || true
  fi
}
