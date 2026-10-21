#!/bin/sh
set -eu
apt-get update
apt-get install -y --no-install-recommends \
  curl ca-certificates fuse-overlayfs iproute2 iptables jq git python3 \
  qemu-system-x86 qemu-system-arm qemu-utils qemu-efi-aarch64 genisoimage
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian trixie stable\n' "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io
apt-get clean
rm -rf /var/lib/apt/lists/*
useradd --create-home --uid 1000 --shell /bin/bash app
install -d /etc/docker /usr/local/libexec
ln -s /usr/local/share/ci-runner/daemon.json /etc/docker/daemon.json
for name in engine vm-worker vm-pool request-vm prepare-vm; do
  suffix=sh
  [ "$name" != vm-pool ] || suffix=py
  ln -s "/usr/local/share/ci-runner/$name.$suffix" "/usr/local/bin/$name.$suffix"
done
ln -s /usr/local/share/ci-runner/runc-nested.sh /usr/local/bin/runc-nested
ln -s /usr/local/share/ci-runner/vm.sh /usr/local/libexec/runner-vm.sh
ln -s /usr/local/share/ci-runner/docker-client.sh /usr/local/libexec/runner-docker-client.sh
ln -s /usr/local/share/ci-runner/guest-cloud-init.yaml /usr/local/share/runner-guest-cloud-init.yaml
ln -s /usr/local/share/ci-runner/guest-images.json /usr/local/share/runner-guest-images.json
