# Forgejo Runner

## Documentation

- [Forgejo Actions documentation](https://forgejo.org/docs/latest/admin/actions/) — upstream reference for workflow syntax, runners, and the Actions admin settings.

## What you get on StartOS

A CI/CD runner that executes Forgejo Actions workflows for the **Forgejo on this device**. Each job runs in its own isolated, rootless container, and jobs that target another CPU architecture (`arm64`, `riscv64`) run under emulation automatically. The runner has no interface of its own — you see it and its job logs inside Forgejo, in its Runners list and the Actions tab.

## Getting set up

This runner serves the Forgejo on the same device, so install and start **Forgejo** first.

1. In Forgejo, create a runner registration token under **Site / Organization / Repository Settings → Actions → Runners → Create new Runner**, and copy it.
2. Run the **Configure** action here and paste the token. Adjust the runner name, labels, and concurrent-jobs count if you like — the default `ubuntu-latest` label runs jobs in a standard Ubuntu image.
3. Start (or restart) the service. It registers with Forgejo and begins picking up jobs; it should appear as **Online** in Forgejo's Runners.

> Running **Configure** re-registers the runner on the next start, so supply a fresh token each time (registration tokens are single-use).

## Using Forgejo Runner

Once it is online, Forgejo dispatches workflow jobs to it automatically — there is nothing to drive here day to day. Follow progress and read job logs in Forgejo's **Actions** tab; the service logs here show registration and startup.

### Labels and architecture

A workflow's `runs-on:` is matched against the runner's labels. Add a foreign-architecture label in **Configure** to also serve emulated jobs for that architecture — they work, but are much slower than native, so prefer a separate runner on native hardware for each architecture you build for regularly.
