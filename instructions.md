# Forgejo Runner

## Documentation

- [Forgejo Actions documentation](https://forgejo.org/docs/latest/admin/actions/) — workflows, runners and registration scope.

## What you get on StartOS

You use one runner registration with the **Forgejo on this device**. Follow jobs and logs in Forgejo's **Actions** tab and check execution health here.

With **Virtualization** enabled, each assigned job boots a fresh disposable VM, including jobs running at the same time. Idle slots keep no VM running. Turning virtualization off uses containers that share the StartOS kernel.

## Getting set up

Forgejo must be running with Actions enabled.

1. In Forgejo, open **Repository / Organization / Site Settings → Actions → Runners → Create new Runner**. Create a **persistent**, not ephemeral, registration and copy its UUID and token. Prefer repository scope unless every repository in a broader scope is trusted.
2. Complete **Configure** here. Enter those credentials and choose labels and concurrency. The default label is `ubuntu-latest`.
3. Leave **Virtualization** enabled for the guest-kernel boundary. If KVM is unavailable, the switch is off and disabled with an explanation; you can still use container mode.
4. Start the service. First-time VM preparation can take several minutes and needs internet access. **VM Image Preparation** reports **Loading** during download and installation. Once prepared, the registration appears online in Forgejo and idle **Virtualized Jobs** checks show **Waiting for a job; no VM allocated**.

A workflow can select the default label with:

```yaml
runs-on: ubuntu-latest
```

**Labels route work; they do not control access.** Use Forgejo registration scope to decide which repositories may submit jobs.

## Choosing execution mode

**Virtualization** adds a guest-kernel boundary and discards each job's VM afterward. Jobs wait for their VM to boot; idle slots use only the host-side controller. Active guests share one memory budget: a lone job can borrow more RAM, and memory is redistributed when another job arrives or finishes. VM startup or runtime failures are reported; they never silently switch to containers.

**Container mode** starts faster and uses less memory, but jobs run privileged containers with access to their engine and share the StartOS kernel. Use it only for trusted workflows.

Saving **Configure** interrupts active jobs and restarts execution. **Concurrent Jobs** limits assigned Forgejo tasks, not parallel steps or nested matrix jobs inside a remote reusable workflow; those share the assigned task's VM and memory. It is a maximum, not a promise that every assigned job starts immediately. If active guests cannot release memory yet, an assigned job waits and reports provisioning in its logs. Guest memory includes space for kernel allocations; busy or kernel-pinned memory is not reassigned until reclaimed. Keep concurrency low for large builds; reduce concurrency or free disk space if configuration reports insufficient resources.

## Images and emulation

The first use of an image downloads it. Container mode retains image caches; VM job caches disappear with the job, so use workflow-managed external caches or artifact storage where appropriate. The runner fetches `uses:` action sources separately for each job in either mode.

Enable **Enable Emulation** to serve the other CPU architecture. On an x86_64 device, this adds `linux-arm64`; on an ARM64 device it adds `linux-amd64`. Emulated jobs are slower. Labels must use `name:docker://image`; host-execution labels are unsupported.

## Docker builds

Jobs receive a Docker socket within their selected execution environment. You can run Docker and Buildx commands, or use a setup action that starts another daemon. The standard `/root/setup-docker-action` working directory is backed by build scratch; select an equivalent scratch arrangement if you change it.

For the workflow's own Forgejo repository, use a checkout action that authenticates with the job token:

```yaml
- uses: https://github.com/actions/checkout@v4
```

Upload any artifacts you want to keep before a virtualized job finishes. Files left only on its VM are deleted. The runner installs the OS root certificate in workflow job containers and routes Forgejo's `.local` names through the OS bridge, with TLS verification enabled. Node actions receive the certificate as extra trust. Custom images without a system CA updater must supply their own trust tooling for other clients.

## Replacing a forgotten registration

If connection health says Forgejo no longer recognizes the runner, create a replacement persistent registration in Forgejo and update **Configure**. You still need only one registration, regardless of concurrency.
