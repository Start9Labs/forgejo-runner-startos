#!/bin/bash
: "${VM_CPU_CORES:?}"
VM_BACKEND_LIB=/usr/local/libexec/runner-vm.sh
source /usr/local/libexec/runner-guest.sh
guest_recover qemu-system
POOL_COMMAND=(python3 -B /usr/local/bin/vm-pool.py)

vm_arch() {
  case "$(uname -m)" in
    x86_64) printf amd64 ;;
    aarch64) printf arm64 ;;
    *) echo 'Unsupported VM architecture' >&2; return 1 ;;
  esac
}

vm_create_disk() {
  local base=$1 disk_gb=$2 user_data=$3
  mkdir -p /vm /data
  rm -f /vm/root.qcow2 /vm/seed.iso /vm/vars.fd
  rm -rf /vm/seed-input
  mkdir -p /vm/seed-input
  qemu-img create -f qcow2 -F qcow2 -b "$base" /vm/root.qcow2 "${disk_gb}G"
  cp "$user_data" /vm/seed-input/user-data
  printf 'instance-id: runner-%s\nlocal-hostname: %s\n' "$(cat /proc/sys/kernel/random/uuid)" "${VM_GUEST_HOSTNAME:-runner-job}" > /vm/seed-input/meta-data
  genisoimage -quiet -output /vm/seed.iso -volid cidata -joliet -rock /vm/seed-input/user-data /vm/seed-input/meta-data
}

vm_start() {
  local -a machine
  rm -f /vm/qmp.sock
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
    -qmp unix:/vm/qmp.sock,server=on,wait=off -no-reboot &
  guest_record_pid "$!"
}

vm_dispose() {
  vm_stop_process
  rm -f /vm/qmp.sock /vm/root.qcow2 /vm/seed.iso /vm/vars.fd
  rm -rf /data/tls /data/user-data /vm/seed-input
}

guest_worker_init() {
  : "${VM_DISK_GB:?}" "${VM_POOL_MEMORY_MB:?}" "${VM_BOOT_MEMORY_MB:?}" "${VM_MEMORY_BLOCK_MB:?}" "${VM_MEMORY_DEVICE_ID:?}"
  VM_MEMORY_ARGS=(-m "${VM_BOOT_MEMORY_MB}M,maxmem=${VM_POOL_MEMORY_MB}M,slots=1"
    -object "memory-backend-ram,id=pool-memory,size=$((VM_POOL_MEMORY_MB-VM_BOOT_MEMORY_MB))M"
    -device "virtio-mem-pci,id=$VM_MEMORY_DEVICE_ID,memdev=pool-memory,requested-size=0,block-size=${VM_MEMORY_BLOCK_MB}M")
}

guest_worker_wait() {
  local deadline=$((SECONDS + 30))
  until "${POOL_COMMAND[@]}" status >/dev/null 2>&1; do
    if ((SECONDS >= deadline)); then echo 'Memory controller did not become ready' >&2; return 1; fi
    sleep 0.2
  done
}

guest_reserve() { "${POOL_COMMAND[@]}" acquire > /vm/grant.json; }
guest_launch() {
  guest_user_data /usr/local/share/runner-guest-cloud-init.yaml /data/user-data
  vm_create_disk /base/prepared.qcow2 "$VM_DISK_GB" /data/user-data
}
guest_connect() { vm_start; }
guest_started() { "${POOL_COMMAND[@]}" started > /vm/grant.json; }
guest_release() { "${POOL_COMMAND[@]}" release; }

guest_image_current() {
  VM_PREPARED_FINGERPRINT=$(guest_fingerprint "$(vm_arch)")
  [ -f /cache/prepared.qcow2 ] && [ "$(cat /cache/prepared.id 2>/dev/null)" = "$VM_PREPARED_FINGERPRINT" ]
}

guest_prepare_launch() {
  VM_MEMORY_ARGS=(-m "${VM_MEMORY_MB:?}")
  local arch images=/usr/local/share/runner-guest-images.json release expected base_url image
  arch=$(vm_arch)
  release=$(jq -r .release "$images")
  expected=$(jq -r --arg arch "$arch" '.sha512[$arch]' "$images")
  base_url=$(jq -r .baseUrl "$images")
  image=/cache/cloud-$arch.qcow2
  if [ ! -f "$image" ] || ! printf '%s  %s\n' "$expected" "$image" | sha512sum --check --status; then
    curl --fail --location --retry 3 --output "$image.tmp" "$base_url/$release/debian-13-genericcloud-$arch-$release.qcow2"
    printf '%s  %s\n' "$expected" "$image.tmp" | sha512sum --check --status
    mv "$image.tmp" "$image"
  fi
  guest_preparation_user_data /usr/local/share/runner-guest-cloud-init.yaml /data/prepare-user-data
  vm_create_disk "$image" 8 /data/prepare-user-data
  vm_start
}

guest_wait_poweroff() {
  local attempt
  for ((attempt=0; attempt<60; attempt++)); do
    if ! kill -0 "$VM_GUEST_PID" 2>/dev/null; then break; fi
    sleep 1
  done
  if kill -0 "$VM_GUEST_PID" 2>/dev/null; then
    echo 'Guest did not power off after image preparation' >&2
    return 1
  fi
  wait "$VM_GUEST_PID"
  VM_GUEST_PID=
  rm -f /vm/guest.pid
}

guest_image_publish() {
  qemu-img convert -f qcow2 -O qcow2 /vm/root.qcow2 /cache/prepared.qcow2.tmp
  mv /cache/prepared.qcow2.tmp /cache/prepared.qcow2
  printf '%s' "$VM_PREPARED_FINGERPRINT" > /cache/prepared.id
}
