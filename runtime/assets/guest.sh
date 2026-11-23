#!/bin/bash
VM_DOCKER_PORT=${VM_DOCKER_PORT:-23750}
VM_GUEST_PID=
source /usr/local/libexec/runner-docker-client.sh
export DOCKER_HOST=tcp://127.0.0.1:$VM_DOCKER_PORT
export DOCKER_TLS_VERIFY=1
export DOCKER_CERT_PATH=/data/tls/client
unset DOCKER_CONTEXT DOCKER_API_VERSION

vm_issue_certificate() {
  local name=$1 usage=$2
  mkdir -p "/data/tls/$name"
  openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "/data/tls/$name/key.pem"
  openssl req -new -key "/data/tls/$name/key.pem" -subj "/CN=runner-vm-$name" -out "/data/tls/$name/request.pem"
  printf 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=%s\nsubjectAltName=IP:127.0.0.1\n' "$usage" > "/data/tls/$name/extensions"
  openssl x509 -req -in "/data/tls/$name/request.pem" -CA /data/tls/ca.pem -CAkey /data/tls/ca.key -CAcreateserial -days 365 -extfile "/data/tls/$name/extensions" -out "/data/tls/$name/cert.pem"
  cp /data/tls/ca.pem "/data/tls/$name/ca.pem"
  rm "/data/tls/$name/request.pem" "/data/tls/$name/extensions"
}

# Writes cloud-init user-data carrying a fresh guest-only Docker server identity.
guest_user_data() {
  local template=$1 output=$2 guest_hostname=${VM_GUEST_HOSTNAME:-runner-job}
  rm -rf /data/tls
  mkdir -p /data/tls
  openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out /data/tls/ca.key
  openssl req -new -x509 -key /data/tls/ca.key -days 365 -subj /CN=runner-vm-ca -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign' -out /data/tls/ca.pem
  vm_issue_certificate server serverAuth
  vm_issue_certificate client clientAuth
  rm /data/tls/ca.key
  sed \
    -e "s|@STARTOS_ROOT_CA@|$(base64 -w0 "${RUNNER_ROOT_CA:?}")|g" \
    -e "s|@TLS_CA@|$(base64 -w0 /data/tls/ca.pem)|g" \
    -e "s|@TLS_SERVER_CERT@|$(base64 -w0 /data/tls/server/cert.pem)|g" \
    -e "s|@TLS_SERVER_KEY@|$(base64 -w0 /data/tls/server/key.pem)|g" \
    -e "s|@GUEST_HOSTNAME@|$guest_hostname|g" \
    -e "s|@DOCKER_LISTEN_ADDRESS@|${VM_DOCKER_LISTEN_ADDRESS:-0.0.0.0}|g" \
    "$template" > "$output"
  rm -rf /data/tls/server
}

# Preparation user-data additionally installs the guest's Docker engine.
guest_preparation_user_data() {
  guest_user_data "$1" "$2"
  printf '\npackage_update: true\npackages: [docker.io, curl, socat]\n' >> "$2"
}

# Identifies the prepared image's inputs; a change rebuilds it.
guest_fingerprint() {
  { printf '%s\n' "$@"; sha256sum /usr/local/share/runner-guest-images.json /usr/local/share/runner-guest-cloud-init.yaml "${RUNNER_ROOT_CA:?}" /usr/local/libexec/runner-guest.sh "$VM_BACKEND_LIB" /usr/local/bin/prepare-vm.sh; } | sha256sum | cut -d' ' -f1
}

guest_record_pid() {
  VM_GUEST_PID=$1
  printf '%s' "$VM_GUEST_PID" > /vm/guest.pid
}

# Adopts a guest process left by an earlier worker so disposal stops it.
guest_recover() {
  local old
  old=$(cat /vm/guest.pid 2>/dev/null) || return 0
  if [[ "$old" =~ ^[0-9]+$ ]] && grep -q "^$1" "/proc/$old/comm" 2>/dev/null; then VM_GUEST_PID=$old; fi
}

vm_wait_ready() {
  local deadline=$((SECONDS + 300))
  while ((SECONDS < deadline)); do
    kill -0 "$VM_GUEST_PID"
    if curl -fsS --max-time 3 --cacert "$DOCKER_CERT_PATH/ca.pem" --cert "$DOCKER_CERT_PATH/cert.pem" --key "$DOCKER_CERT_PATH/key.pem" "https://127.0.0.1:$VM_DOCKER_PORT/_ping" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  printf 'failed\n' > /vm/phase
  echo 'Guest Docker did not become ready' >&2
  return 1
}

vm_terminate_process() {
  local pid=$1 attempt
  kill -- "$pid" 2>/dev/null || true
  for ((attempt=0; attempt<50; attempt++)); do
    if ! kill -0 -- "$pid" 2>/dev/null; then break; fi
    sleep 0.1
  done
  kill -KILL -- "$pid" 2>/dev/null || true
}

vm_stop_process() {
  if [ -n "$VM_GUEST_PID" ]; then
    vm_terminate_process "$VM_GUEST_PID"
    wait "$VM_GUEST_PID" 2>/dev/null || true
    VM_GUEST_PID=
  fi
  rm -f /vm/guest.pid
}

record_preparation() {
  printf '%s %s\n' "$$" "$1" > "$VM_PREPARATION_STATUS.tmp"
  mv "$VM_PREPARATION_STATUS.tmp" "$VM_PREPARATION_STATUS"
}
