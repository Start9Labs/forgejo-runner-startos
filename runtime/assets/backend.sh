#!/bin/bash
case "${VM_BACKEND:-qemu}" in
  qemu) source /usr/local/libexec/runner-vm.sh ;;
  incus) source /usr/local/libexec/runner-incus.sh ;;
  *) echo 'Unsupported guest backend' >&2; exit 1 ;;
esac
