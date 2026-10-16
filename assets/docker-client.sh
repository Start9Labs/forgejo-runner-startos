#!/bin/bash
export DOCKER_CONFIG=/data/docker-client
mkdir -p "$DOCKER_CONFIG"
printf '%s\n' '{"auths":{}}' > "$DOCKER_CONFIG/config.json"
