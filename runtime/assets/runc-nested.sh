#!/bin/sh
set -eu
bundle=""
previous=""
for arg in "$@"; do
  case "$previous" in --bundle|-b) bundle="$arg"; break;; esac
  case "$arg" in --bundle=*) bundle="${arg#--bundle=}"; break;; esac
  previous="$arg"
done
config="$bundle/config.json"
if [ -n "$bundle" ] && [ -f "$config" ]; then
  temporary=$(mktemp "$config.XXXXXX")
  jq 'del(.linux.sysctl["net.ipv4.ip_unprivileged_port_start"])' \
    "$config" > "$temporary"
  mv "$temporary" "$config"
fi
exec /usr/bin/runc "$@"
