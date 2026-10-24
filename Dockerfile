ARG BINFMT_IMAGE
FROM --platform=$BUILDPLATFORM golang:1.26.10-trixie AS runner
WORKDIR /src
COPY upstream/ ./
COPY patches/ /patches/
RUN for file in /patches/*.patch; do git apply "$file"; done
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go test -short -run '^Test(Action|RemoteAction|StepActionLocal|StepActionRemote|TrustedRootCA|SerialJobs)' ./act/runner \
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

COPY runtime/assets/install-runtime.sh /usr/local/share/ci-runner/install-runtime.sh
RUN sh /usr/local/share/ci-runner/install-runtime.sh
# The base image's CA store is only as current as its last release.
RUN apt-get update \
 && apt-get install -y --no-install-recommends --only-upgrade ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && ! grep -q MIICTjCCAdOgAwIBAgIKPPYHqWhwDtqLhDAKBggqhkjOPQQDAzBr /etc/ssl/certs/ca-certificates.crt
COPY runtime/assets/ /usr/local/share/ci-runner/

COPY --from=runner /bin/forgejo-runner /usr/local/bin/forgejo-runner
COPY --from=binfmt /usr/bin/ /usr/bin/

COPY assets/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER app
WORKDIR /home/app
