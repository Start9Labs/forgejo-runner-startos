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

### First run

The first job on each label pulls its container image before anything else runs — the default
`ubuntu-latest` image is about 1 GB, so **Set up job** can sit for a minute or two showing only a
spinner. The image is cached afterward; later runs start in seconds.

### Checking out your repository

To check out the repository a workflow belongs to, use the standard action — it authenticates
automatically with the job's token, so private repositories work with no extra setup:

```yaml
- uses: actions/checkout@v4
```

To clone in a plain `run:` step instead, authenticate with the job's token; the in-job clone URL
is anonymous by default and fails on private repositories:

```yaml
- run: git clone "http://ci:${{ github.token }}@${GITHUB_SERVER_URL#*://}/${GITHUB_REPOSITORY}.git" .
```
