# Forgejo Runner binary, pulled from the official multi-arch image (pinned).
# Bump the tag here and the version in startos/versions/current.ts together.
FROM code.forgejo.org/forgejo/runner:12.12.0 AS runner

FROM debian:trixie-slim

# Rootless Podman + its prerequisites (fuse-overlayfs storage, slirp4netns
# networking). See start-docs recipe-nested-oci-runtime. Also git: the runner
# fetches `uses:` actions with the git CLI — without it every `uses:` step fails
# at the action fetch (exec: "git": executable file not found in $PATH).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      podman fuse-overlayfs uidmap iproute2 iptables nftables aardvark-dns \
      passt slirp4netns ca-certificates git \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

COPY --from=runner /bin/forgejo-runner /usr/local/bin/forgejo-runner

RUN mkdir -p /etc/containers \
 && printf 'unqualified-search-registries = ["docker.io"]\n' \
        > /etc/containers/registries.conf

# Non-root user + subordinate UID/GID ranges for nested user namespaces. The
# range must live inside the subcontainer's userns (0..65535) and must not
# overlap the user's own UID (1000) — so start at 1001.
RUN useradd --create-home --uid 1000 --shell /bin/bash app \
 && echo 'app:1001:64535' > /etc/subuid \
 && echo 'app:1001:64535' > /etc/subgid

COPY assets/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER app
WORKDIR /home/app
