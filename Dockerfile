ARG BINFMT_IMAGE=tonistiigi/binfmt@sha256:400a4873b838d1b89194d982c45e5fb3cda4593fbfd7e08a02e76b03b21166f0
FROM --platform=$BUILDPLATFORM golang:1.26.8-trixie AS runner
WORKDIR /src
COPY upstream/ ./
COPY patches/ /patches/
RUN for file in /patches/*.patch; do git apply "$file"; done
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go test -short -run '^Test(Action|RemoteAction|StepActionLocal|StepActionRemote|TrustedRootCA)' ./act/runner \
 && CGO_ENABLED=0 go test -short ./act/container/docker \
 && CGO_ENABLED=0 go test -short -run '^Test(BeforeJob|JobActionCache)' ./internal/app/run ./internal/app/cmd ./internal/pkg/config \
 && CGO_ENABLED=0 go test -short ./internal/app/poll
ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -tags netgo,osusergo \
      -ldflags '-s -w -X code.forgejo.org/forgejo/runner/v13/internal/pkg/ver.version=v13.2.0' \
      -o /bin/forgejo-runner .
FROM $BINFMT_IMAGE AS binfmt

FROM debian:trixie-slim
ARG BINFMT_IMAGE
RUN mkdir -p /usr/local/share && printf '%s\n' "$BINFMT_IMAGE" > /usr/local/share/binfmt-image

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates fuse-overlayfs iproute2 iptables jq git python3 \
      qemu-system-x86 qemu-system-arm qemu-utils qemu-efi-aarch64 genisoimage \
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
COPY assets/vm.sh /usr/local/libexec/runner-vm.sh
COPY assets/docker-client.sh /usr/local/libexec/runner-docker-client.sh
COPY assets/prepare-vm.sh /usr/local/bin/prepare-vm.sh
COPY assets/vm-worker.sh /usr/local/bin/vm-worker.sh
COPY assets/request-vm.sh /usr/local/bin/request-vm.sh
COPY assets/vm-pool.py /usr/local/bin/vm-pool.py
COPY assets/guest-images.json /usr/local/share/runner-guest-images.json
COPY assets/guest-cloud-init.yaml /usr/local/share/runner-guest-cloud-init.yaml
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/runc-nested /usr/local/bin/engine.sh /usr/local/bin/prepare-vm.sh /usr/local/bin/vm-worker.sh /usr/local/bin/request-vm.sh

USER app
WORKDIR /home/app
