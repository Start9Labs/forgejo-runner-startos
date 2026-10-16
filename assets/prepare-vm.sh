#!/bin/bash
set -euo pipefail
umask 077
source /usr/local/libexec/runner-vm.sh
trap vm_dispose EXIT
trap 'exit 143' TERM INT
mkdir -p /cache /vm /data
arch=$(vm_arch)
images=/usr/local/share/runner-guest-images.json
template=/usr/local/share/runner-guest-cloud-init.yaml
release=$(jq -r .release "$images")
expected=$(jq -r --arg arch "$arch" '.sha512[$arch]' "$images")
base_url=$(jq -r .baseUrl "$images")
helper_image=$(jq -r .helperImage "$images")
image=/cache/cloud-$arch.qcow2
fingerprint=$({ printf '%s\n' "$arch"; sha256sum "$images" "$template" /usr/local/libexec/runner-vm.sh /usr/local/bin/prepare-vm.sh; } | sha256sum | cut -d' ' -f1)
if [ -f /cache/prepared.qcow2 ] && [ "$(cat /cache/prepared.id 2>/dev/null)" = "$fingerprint" ]; then
  echo 'Prepared guest image is current'
  exit 0
fi
if [ ! -f "$image" ] || ! printf '%s  %s\n' "$expected" "$image" | sha512sum --check --status; then
  curl --fail --location --retry 3 --output "$image.tmp" "$base_url/$release/debian-13-genericcloud-$arch-$release.qcow2"
  printf '%s  %s\n' "$expected" "$image.tmp" | sha512sum --check --status
  mv "$image.tmp" "$image"
fi
cp "$template" /data/prepare-user-data
printf '\npackage_update: true\npackages: [docker.io, curl]\n' >> /data/prepare-user-data
vm_boot "$image" 8 /data/prepare-user-data
vm_wait_ready
docker run --rm --privileged --pid=host --volume /:/guest-root --entrypoint chroot "$helper_image" /guest-root /bin/sh -ec '
  cloud-init status --wait
  rm -f /var/lib/runner-scratch/.ready
  rm -rf /etc/docker/tls
  cloud-init clean --logs --machine-id --seed
  sync
  systemctl --no-block poweroff
'
for ((attempt=0; attempt<60; attempt++)); do
  if ! kill -0 "$VM_QEMU_PID" 2>/dev/null; then break; fi
  sleep 1
done
if kill -0 "$VM_QEMU_PID" 2>/dev/null; then
  echo 'Guest did not power off after image preparation' >&2
  exit 1
fi
wait "$VM_QEMU_PID"
VM_QEMU_PID=
qemu-img convert -f qcow2 -O qcow2 /vm/root.qcow2 /cache/prepared.qcow2.tmp
mv /cache/prepared.qcow2.tmp /cache/prepared.qcow2
printf '%s' "$fingerprint" > /cache/prepared.id
echo 'Prepared guest image is ready'
