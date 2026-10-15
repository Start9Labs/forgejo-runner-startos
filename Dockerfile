# Forgejo Runner binary, pulled from the official multi-arch image (pinned).
# Bump the tag here and the version in startos/versions/current.ts together.
FROM code.forgejo.org/forgejo/runner:13.2.0 AS runner
FROM tonistiigi/binfmt@sha256:400a4873b838d1b89194d982c45e5fb3cda4593fbfd7e08a02e76b03b21166f0 AS binfmt

FROM debian:trixie-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates fuse-overlayfs iproute2 iptables jq git \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg \
      -o /etc/apt/keyrings/docker.asc \
 && chmod a+r /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian trixie stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

COPY --from=runner /bin/forgejo-runner /usr/local/bin/forgejo-runner
COPY --from=binfmt /usr/bin/ /usr/bin/

RUN useradd --create-home --uid 1000 --shell /bin/bash app

COPY assets/daemon.json /etc/docker/daemon.json
COPY assets/runc-nested.sh /usr/local/bin/runc-nested
COPY assets/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY assets/engine.sh /usr/local/bin/engine.sh
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/runc-nested /usr/local/bin/engine.sh

USER app
WORKDIR /home/app
