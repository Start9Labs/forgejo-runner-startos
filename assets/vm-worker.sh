#!/bin/bash
set -euo pipefail
umask 077
source /usr/local/libexec/runner-vm.sh
: "${VM_DISK_GB:?}"
: "${VM_POOL_MEMORY_MB:?}"
: "${VM_BOOT_MEMORY_MB:?}"
: "${VM_MEMORY_BLOCK_MB:?}"
: "${VM_MEMORY_DEVICE_ID:?}"
: "${VM_SLOT:?}"
VM_MEMORY_ARGS=(-m "${VM_BOOT_MEMORY_MB}M,maxmem=${VM_POOL_MEMORY_MB}M,slots=1"
  -object "memory-backend-ram,id=pool-memory,size=$((VM_POOL_MEMORY_MB-VM_BOOT_MEMORY_MB))M"
  -device "virtio-mem-pci,id=$VM_MEMORY_DEVICE_ID,memdev=pool-memory,requested-size=0,block-size=${VM_MEMORY_BLOCK_MB}M")
runner_pid=
step_pid=
stopping=false
POOL_COMMAND=(python3 -B /usr/local/bin/vm-pool.py)
stop_runner() {
  if [ -n "$runner_pid" ]; then
    vm_terminate_process "-$runner_pid"
    wait "$runner_pid" 2>/dev/null || true
    runner_pid=
  fi
  rm -f /vm/runner.pgid
}
dispose_job() {
  vm_dispose
  if [ -f /vm/lease ]; then
    export VM_LEASE="$(cat /vm/lease)"
    rm /vm/lease
    "${POOL_COMMAND[@]}" release
  fi
  rm -f /vm/request /vm/request.tmp /vm/grant.json
}
cleanup() {
  local status=$?
  printf 'failed\n' > /vm/phase
  if [ -n "$step_pid" ]; then
    vm_terminate_process "$step_pid"
    wait "$step_pid" 2>/dev/null || true
  fi
  if [ "$stopping" = false ] && [ "$status" -ne 0 ] && [ -n "$runner_pid" ]; then
    local deadline=$((SECONDS + 180))
    echo 'Draining the assigned job failure report' >&2
    while kill -0 "$runner_pid" 2>/dev/null && ((SECONDS < deadline)); do sleep 0.2; done
  fi
  stop_runner
  dispose_job || true
  rm -f /vm/controller.pid
}
wait_stage() {
  local stage=$1 completed_pid
  local -a children=("$runner_pid" "$stage")
  if [ -n "$VM_QEMU_PID" ]; then children+=("$VM_QEMU_PID"); fi
  step_pid=$stage
  if wait -n -p completed_pid "${children[@]}"; then status=0; else status=$?; fi
  if [ "${completed_pid:-}" != "$stage" ]; then return 1; fi
  step_pid=
  return "$status"
}
mkdir -p /data/runner/run /vm
if [ -f /vm/runner.pgid ]; then runner_pid=$(cat /vm/runner.pgid); stop_runner; fi
if [ -f /vm/qemu.pid ]; then
  old=$(cat /vm/qemu.pid)
  if [[ "$old" =~ ^[0-9]+$ ]] && grep -q '^qemu-system' "/proc/$old/comm" 2>/dev/null; then VM_QEMU_PID=$old; fi
fi
dispose_job || true
trap cleanup EXIT
trap 'stopping=true; exit 143' TERM INT
printf '%s' "$$" > /vm/controller.pid
deadline=$((SECONDS + 30))
until "${POOL_COMMAND[@]}" status >/dev/null 2>&1; do
  if ((SECONDS >= deadline)); then echo 'Memory controller did not become ready' >&2; exit 1; fi
  sleep 0.2
done
while true; do
  export VM_LEASE="$(cat /proc/sys/kernel/random/uuid)"
  printf '%s' "$VM_LEASE" > /vm/lease
  printf 'idle\n' > /vm/phase
  setsid /usr/local/bin/entrypoint.sh one-job --wait &
  runner_pid=$!
  printf '%s' "$runner_pid" > /vm/runner.pgid
  while [ ! -e /vm/request ]; do
    if ! kill -0 "$runner_pid" 2>/dev/null; then wait "$runner_pid"; exit 1; fi
    sleep 0.2
  done
  test "$(cat /vm/request)" = "$VM_LEASE"
  printf 'budget\n' > /vm/phase
  "${POOL_COMMAND[@]}" acquire > /vm/grant.json &
  wait_stage "$!"
  vm_boot /base/prepared.qcow2 "$VM_DISK_GB" /usr/local/share/runner-guest-cloud-init.yaml
  bash -ec 'source /usr/local/libexec/runner-vm.sh; VM_QEMU_PID=$1; vm_wait_ready' vm-ready "$VM_QEMU_PID" &
  wait_stage "$!"
  "${POOL_COMMAND[@]}" started > /vm/grant.json &
  wait_stage "$!"
  if [ "${RUNNER_EMULATION:-false}" = true ]; then
    docker run --rm --privileged "$(cat /usr/local/share/binfmt-image)" --install all &
    wait_stage "$!"
  fi
  printf 'ready\n' > /vm/phase
  kill -0 "$VM_QEMU_PID"
  if wait -n -p completed_pid "$runner_pid" "$VM_QEMU_PID"; then status=0; else status=$?; fi
  if [ "${completed_pid:-}" != "$runner_pid" ]; then
    VM_QEMU_PID=
    echo 'Guest exited before the job worker completed' >&2
    exit 1
  fi
  stop_runner
  if [ "$status" -ne 0 ]; then exit "$status"; fi
  printf 'recycling\n' > /vm/phase
  dispose_job
  echo 'Job VM disposed and memory lease returned'
done
