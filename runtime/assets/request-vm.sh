#!/bin/bash
set -euo pipefail
printf '%s' "${VM_LEASE:?}" > /vm/request.tmp
mv /vm/request.tmp /vm/request
echo 'Waiting for shared memory and a disposable job VM'
while true; do
  case "$(cat /vm/phase)" in
    ready) exit 0 ;;
    failed) echo 'Job VM provisioning failed' >&2; exit 1 ;;
  esac
  sleep 0.2
done
