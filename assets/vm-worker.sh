#!/bin/bash
set -euo pipefail
umask 077
source /usr/local/libexec/runner-vm.sh
: "${VM_DISK_GB:?}"
runner_pid=
cleanup() {
  if [ -n "$runner_pid" ]; then
    vm_terminate_process "-$runner_pid"
    wait "$runner_pid" 2>/dev/null || true
    runner_pid=
  fi
  vm_dispose
  rm -f /vm/controller.pid
}
trap cleanup EXIT
trap 'exit 143' TERM INT
mkdir -p /data/runner/run /vm
printf '%s' "$$" > /vm/controller.pid
while true; do
  vm_boot /base/prepared.qcow2 "$VM_DISK_GB" /usr/local/share/runner-guest-cloud-init.yaml
  vm_wait_ready
  if [ "${RUNNER_EMULATION:-false}" = true ]; then
    docker run --rm --privileged "$(cat /usr/local/share/binfmt-image)" --install all
  fi
  printf 'ready\n' > /vm/phase
  setsid /usr/local/bin/entrypoint.sh one-job --wait &
  runner_pid=$!
  if wait -n -p completed_pid "$runner_pid" "$VM_QEMU_PID"; then status=0; else status=$?; fi
  if [ "$completed_pid" != "$runner_pid" ]; then
    VM_QEMU_PID=
    printf 'failed\n' > /vm/phase
    echo 'Guest exited before the job worker completed; draining its failure report' >&2
    deadline=$((SECONDS + 180))
    while kill -0 "$runner_pid" 2>/dev/null && ((SECONDS < deadline)); do sleep 0.2; done
    exit 1
  fi
  vm_terminate_process "-$runner_pid"
  runner_pid=
  if [ "$status" -ne 0 ]; then exit "$status"; fi
  printf 'recycling\n' > /vm/phase
  vm_dispose
  echo 'Job VM disposed'
done
