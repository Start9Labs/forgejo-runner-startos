# Forgejo Runner

## Documentation

- [Forgejo Actions documentation](https://forgejo.org/docs/latest/admin/actions/) — upstream reference for workflow syntax, runners, and the Actions admin settings.

## What you get on StartOS

A CI/CD runner that executes Forgejo Actions workflows for the **Forgejo on this device**. Each job runs in its own isolated, rootless container, and foreign-architecture container images run under emulation automatically. The runner has no interface of its own — you see it and its job logs inside Forgejo, in its Runners list and the Actions tab.

## Getting set up

This runner serves the Forgejo on the same device, so install and start **Forgejo** first.

1. In Forgejo, go to **Site / Organization / Repository Settings → Actions → Runners → Create new Runner**. Copy the **UUID** and the **token** it shows you.
2. Run the **Configure** action here and paste in the UUID and token. Adjust the labels and concurrent-jobs count if you like — the default `ubuntu-latest` label runs jobs in a standard Ubuntu image.
3. Start (or restart) the service. It connects to Forgejo and begins picking up jobs; it should appear as **Online** in Forgejo's Runners.

> Forgejo v12 replaced the old single-use registration token with durable runner credentials, so the UUID + token you paste here keep working — there is nothing to refresh between restarts.

## Using Forgejo Runner

Once it is online, Forgejo dispatches workflow jobs to it automatically — there is nothing to drive here day to day. Follow progress and read job logs in Forgejo's **Actions** tab; the service logs here show startup and connection.

### Labels and architecture

A workflow's `runs-on:` is matched against the runner's labels. To also serve jobs built for the other CPU architecture, turn on **Enable Emulation** in **Configure** — it adds a label for that architecture and runs its jobs under emulation. They work, but are much slower than native, so prefer a separate runner on native hardware for each architecture you build for regularly.
