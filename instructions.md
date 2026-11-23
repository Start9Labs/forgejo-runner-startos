# Forgejo Runner

## Documentation

- [Forgejo Actions documentation](https://forgejo.org/docs/latest/admin/actions/) — workflows, runners and registration scope.

## What you get on StartOS

You use one runner registration with the **Forgejo on this device** or a **Forgejo on another server**. Follow jobs and logs in Forgejo's **Actions** tab and check execution health here.

Under **Execution**, choose where jobs run:

- **Local VMs**: each assigned job boots a fresh disposable VM on this device. Idle slots keep no VM running.
- **Remote Incus**: each assigned job boots a fresh disposable VM on an Incus server you run elsewhere, which can be larger than this device or a different CPU architecture.
- **Local containers**: jobs use containers that share the StartOS kernel.

## Getting set up

To use the Forgejo on this device, it must be running with Actions enabled. To use a Forgejo on another server, it needs Actions enabled there, and its address must be reachable from this device.

1. In Forgejo, open **Repository / Organization / Site Settings → Actions → Runners → Create new Runner**. Create a **persistent**, not ephemeral, registration and copy its UUID and token. Prefer repository scope unless every repository in a broader scope is trusted.
2. Complete **Configure** here. Under **Forgejo Instance**, keep **This server**, or choose **Remote server** and enter the address you open Forgejo at, such as `https://forge.example.com`. An HTTPS address needs a publicly trusted certificate, so a remote `.local` address does not work. Enter those credentials and choose labels and concurrency. The default label is `ubuntu-latest`.
3. Under **Execution**, keep **Local VMs** for the guest-kernel boundary, or choose **Remote Incus** (see below). Without accessible KVM, new configurations default to **Local containers** and **Local VMs** cannot be selected.
4. Start the service. First-time VM preparation can take several minutes and needs internet access. **VM Image Preparation** reports **Loading** during download and installation. Once prepared, the registration appears online in Forgejo. **Virtualized Jobs** checks show **Success** when idle and **Loading** while preparing or running a job.

A workflow can select the default label with:

```yaml
runs-on: ubuntu-latest
```

**Labels route work; they do not control access.** Use Forgejo registration scope to decide which repositories may submit jobs.

## Using a remote Incus server

The Incus server must support VMs, and its API must be reachable from this device.

1. On the Incus server, create a trust token with `incus config trust add forgejo-runner`. To restrict the runner to one project, add `--restricted --projects <project>`.
2. In **Configure**, choose **Execution → Remote Incus**. Paste the token into **Trust Token**. Enter **Incus Address** if this device should reach the server at an address other than the ones in the token, for example `https://incus.example.com:8443`.
3. Set **Project** and **Profile**. The profile must give job VMs a root disk and a network with internet access. **Storage Pool** and **Network** are optional overrides. Set the CPU cores, memory and disk each job VM gets.
4. Save. Saving connects to the server immediately and reports any problem. The token is used once and not stored. Leave it empty on later saves; enter a new one only to connect to a different server.

On first start, the runner builds a prepared image on the Incus server, which can take several minutes. Labels follow the Incus server's CPU architecture, and **Enable Emulation** adds the other one. Job VMs reach Forgejo over the Incus server's network: a remote Forgejo must be reachable from there, and the Forgejo on this device only when the Incus server can reach this device. The service does not start while the Incus server is unreachable.

## Choosing execution mode

**Local VMs** adds a guest-kernel boundary and discards each job's VM afterward. Jobs wait for their VM to boot; idle slots use only the host-side controller. Active guests share one memory budget: a lone job can borrow more RAM, and memory is redistributed when another job arrives or finishes. VM startup or runtime failures are reported; they never silently switch to containers. If KVM becomes unavailable while **Local VMs** is selected, a critical Configure task blocks the runner from serving jobs. Restore KVM access and save Configure with **Local VMs**, or explicitly choose another execution mode. Registration is preserved.

**Remote Incus** gives the same per-job VM boundary on another machine. Resources come from that server instead of this device, so jobs never wait for memory here.

**Local containers** start faster and uses less memory, but jobs run privileged containers with access to their engine and share the StartOS kernel. Use it only for trusted workflows.

Saving **Configure** interrupts active jobs and restarts execution. **Concurrent Jobs** limits simultaneous Forgejo assignments. Jobs and matrix entries inside a single reusable-workflow assignment execute sequentially, sharing its VM and memory; they cannot bypass that limit. Raising concurrency allows separate assignments to run together, not the children of one assignment. It is a maximum, not a promise that every assigned job starts immediately. If active guests cannot release memory yet, an assigned job waits and reports provisioning in its logs. Guest memory includes space for kernel allocations; busy or kernel-pinned memory is not reassigned until reclaimed. Keep concurrency low for large builds; reduce concurrency or free disk space if configuration reports insufficient resources.

## Images and emulation

The first use of an image downloads it. Container mode retains image caches; VM job caches disappear with the job, so use workflow-managed external caches or artifact storage where appropriate. The runner fetches `uses:` action sources separately for each job in either mode.

Enable **Enable Emulation** to serve the other CPU architecture. On an x86_64 device, this adds `linux-arm64`; on an ARM64 device it adds `linux-amd64`. Emulated jobs are slower. Labels must use `name:docker://image`; host-execution labels are unsupported.

## Docker builds

Jobs receive a Docker socket within their selected execution environment. You can run Docker and Buildx commands, or use a setup action that starts another daemon. The standard `/root/setup-docker-action` working directory is backed by build scratch; select an equivalent scratch arrangement if you change it.

For the workflow's own Forgejo repository, use a checkout action that authenticates with the job token:

```yaml
- uses: https://github.com/actions/checkout@v4
```

Upload any artifacts you want to keep before a virtualized job finishes. Files left only on its VM are deleted. The runner installs the OS root certificate in workflow job containers and, for the Forgejo on this device, routes its `.local` names through the OS bridge, with TLS verification enabled. Node actions receive the certificate as extra trust. Custom images without a system CA updater must supply their own trust tooling for other clients.

## Replacing a forgotten registration

If connection health says Forgejo no longer recognizes the runner, create a replacement persistent registration in Forgejo and update **Configure**. You still need only one registration, regardless of concurrency.
