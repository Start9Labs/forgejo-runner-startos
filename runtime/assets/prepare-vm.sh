#!/bin/bash
set -euo pipefail
umask 077
source /usr/local/libexec/runner-backend.sh
: "${VM_PREPARATION_STATUS:?}"
finish_preparation() {
  local status=$?
  trap - EXIT
  if ! vm_dispose; then status=1; fi
  if [ "$status" -eq 0 ]; then record_preparation ready; else record_preparation failed; fi
  exit "$status"
}
trap finish_preparation EXIT
trap 'exit 143' TERM INT
mkdir -p /cache /vm /data
record_preparation loading
vm_dispose
if guest_image_current; then
  echo 'Prepared guest image is current'
  exit 0
fi
guest_prepare_launch
vm_wait_ready
docker run --rm --privileged --pid=host --volume /:/guest-root --entrypoint chroot "$(jq -r .helperImage /usr/local/share/runner-guest-images.json)" /guest-root /bin/sh -ec '
  cloud-init status --wait
  rm -f /var/lib/runner-scratch/.ready
  rm -rf /etc/docker/tls
  cloud-init clean --logs --machine-id --seed
  sync
  systemctl --no-block poweroff
'
guest_wait_poweroff
guest_image_publish
echo 'Prepared guest image is ready'
