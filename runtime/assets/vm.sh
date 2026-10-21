#!/bin/bash
: "${VM_CPU_CORES:?}"
VM_DOCKER_PORT=${VM_DOCKER_PORT:-23750}
VM_QEMU_PID=
source /usr/local/libexec/runner-docker-client.sh
export DOCKER_HOST=tcp://127.0.0.1:$VM_DOCKER_PORT
export DOCKER_TLS_VERIFY=1
export DOCKER_CERT_PATH=/data/tls/client
unset DOCKER_CONTEXT DOCKER_API_VERSION

vm_arch() {
  case "$(uname -m)" in
    x86_64) printf amd64 ;;
    aarch64) printf arm64 ;;
    *) echo 'Unsupported VM architecture' >&2; return 1 ;;
  esac
}

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

vm_boot() {
  local base=$1 disk_gb=$2 template=$3 guest_hostname=${VM_GUEST_HOSTNAME:-runner-job}
  mkdir -p /vm /data
  printf 'booting\n' > /vm/phase
  rm -f /vm/root.qcow2 /vm/seed.iso /vm/qemu.pid /vm/qmp.sock /vm/vars.fd
  rm -rf /data/tls /vm/seed-input
  mkdir -p /data/tls /vm/seed-input
  qemu-img create -f qcow2 -F qcow2 -b "$base" /vm/root.qcow2 "${disk_gb}G"
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
    "$template" > /vm/seed-input/user-data
  printf 'instance-id: runner-%s\nlocal-hostname: %s\n' "$(cat /proc/sys/kernel/random/uuid)" "$guest_hostname" > /vm/seed-input/meta-data
  genisoimage -quiet -output /vm/seed.iso -volid cidata -joliet -rock /vm/seed-input/user-data /vm/seed-input/meta-data
  local -a machine
  case "$(vm_arch)" in
    amd64) machine=(qemu-system-x86_64 -machine pc) ;;
    arm64)
      cp /usr/share/AAVMF/AAVMF_VARS.fd /vm/vars.fd
      machine=(qemu-system-aarch64 -machine virt,gic-version=host -drive if=pflash,format=raw,file=/usr/share/AAVMF/AAVMF_CODE.fd,readonly=on -drive if=pflash,format=raw,file=/vm/vars.fd)
      ;;
  esac
  "${machine[@]}" -accel kvm -cpu host -smp "$VM_CPU_CORES" "${VM_MEMORY_ARGS[@]}" -name "${VM_LEASE:-image-preparation}" \
    -device virtio-balloon-pci,free-page-reporting=on \
    -drive file=/vm/root.qcow2,format=qcow2,if=virtio,cache=none,werror=report \
    -drive file=/vm/seed.iso,format=raw,media=cdrom,readonly=on \
    -nic "user,model=virtio-net-pci,hostfwd=tcp:127.0.0.1:$VM_DOCKER_PORT-:2376" \
    -display none -serial file:/vm/serial.log -monitor none \
    -qmp unix:/vm/qmp.sock,server=on,wait=off -pidfile /vm/qemu.pid -no-reboot &
  VM_QEMU_PID=$!
}

vm_wait_ready() {
  local deadline=$((SECONDS + 300))
  while ((SECONDS < deadline)); do
    kill -0 "$VM_QEMU_PID"
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

vm_stop() {
  if [ -n "$VM_QEMU_PID" ]; then
    vm_terminate_process "$VM_QEMU_PID"
    wait "$VM_QEMU_PID" 2>/dev/null || true
    VM_QEMU_PID=
  fi
  rm -f /vm/qemu.pid /vm/qmp.sock
}

vm_dispose() {
  vm_stop
  rm -f /vm/root.qcow2 /vm/seed.iso /vm/vars.fd
  rm -rf /data/tls /vm/seed-input
}
