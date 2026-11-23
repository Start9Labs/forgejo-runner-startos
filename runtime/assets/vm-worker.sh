#!/bin/bash
set -euo pipefail
umask 077
: "${VM_SLOT:?}"
source /usr/local/libexec/runner-backend.sh
runner_pid=
step_pid=
stopping=false
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
    guest_release
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
  if [ -n "$VM_GUEST_PID" ]; then children+=("$VM_GUEST_PID"); fi
  step_pid=$stage
  if wait -n -p completed_pid "${children[@]}"; then status=0; else status=$?; fi
  if [ "${completed_pid:-}" != "$stage" ]; then return 1; fi
  step_pid=
  return "$status"
}
mkdir -p /data/runner/run /vm
if [ -f /vm/runner.pgid ]; then runner_pid=$(cat /vm/runner.pgid); stop_runner; fi
guest_worker_init
dispose_job || true
trap cleanup EXIT
trap 'stopping=true; exit 143' TERM INT
printf '%s' "$$" > /vm/controller.pid
guest_worker_wait
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
  guest_reserve &
  wait_stage "$!"
  printf 'booting\n' > /vm/phase
  guest_launch &
  wait_stage "$!"
  guest_connect
  vm_wait_ready &
  wait_stage "$!"
  guest_started &
  wait_stage "$!"
  if [ "${RUNNER_EMULATION:-false}" = true ]; then
    docker run --rm --privileged "$(cat /usr/local/share/binfmt-image)" --install all &
    wait_stage "$!"
  fi
  printf 'ready\n' > /vm/phase
  kill -0 "$VM_GUEST_PID"
  if wait -n -p completed_pid "$runner_pid" "$VM_GUEST_PID"; then status=0; else status=$?; fi
  if [ "${completed_pid:-}" != "$runner_pid" ]; then
    VM_GUEST_PID=
    echo 'Guest exited before the job worker completed' >&2
    exit 1
  fi
  stop_runner
  if [ "$status" -ne 0 ]; then exit "$status"; fi
  printf 'recycling\n' > /vm/phase
  dispose_job
  echo 'Job VM disposed'
done
