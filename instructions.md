# Forgejo Runner

## Documentation

- [Forgejo Actions documentation](https://forgejo.org/docs/latest/admin/actions/) — workflows, runners, and runner access control.

## What you get on StartOS

You can run two registrations against the **Forgejo on this device**:

- **Runner:** the default, unprivileged runner for ordinary jobs. Jobs do not receive its Docker socket or build scratch.
- **Build Runner:** optional and disabled by default. It supports privileged Docker/Buildx jobs using a separate engine and working area.

You see jobs and logs in Forgejo's **Actions** tab, and connection health here. These runners share one StartOS service boundary: do not treat them as separate VMs or services for mutually hostile workloads.

## Getting set up

Forgejo must be running on this device with Actions enabled.

1. In Forgejo, open **Site / Organization / Repository Settings → Actions → Runners → Create new Runner** for your ordinary jobs. Copy the UUID and token.
2. Complete **Configure** here with those credentials. Its default label is `ubuntu-latest`.
3. Start the service. The registration should appear online in Forgejo, and jobs using `runs-on: ubuntu-latest` can run.

### Enable privileged builds

1. In Forgejo, create a **different registration under the trusted repository or organization**, not at site level. Everyone who can change code executed by this runner must be trusted with its engine and build data.
2. Open **Configure Build Runner**, enable it, and enter that registration's UUID and token. Keep the default `startos-build` label unless you also change your workflows.
3. Set privileged workflow jobs to:

   ```yaml
   runs-on: startos-build
   ```

   Use `ubuntu-latest` for ordinary jobs. The two registrations must use different labels and UUIDs.

**Labels are routing, not access control.** An untrusted repository can request any label. Its access must be denied by the build runner's repository/organization registration scope. Only use an organization scope if all repositories it covers are trusted.

Saving either configuration restarts both runners and can interrupt jobs. To stop privileged builds while keeping ordinary jobs, turn off **Enable Build Runner** in **Configure Build Runner**. Its existing working data remains available if you enable it again.

## Using the runners

Forgejo dispatches jobs automatically. Check its Actions tab for job progress and this service's **Runner** and **Build Runner** health checks for connection problems.

### Images and emulation

The first job for an image downloads it, which can take several minutes. Later jobs reuse that runner's cache; each runner has its own cache.

Turn on **Enable Emulation** in the corresponding configuration when needed. On an x86_64 device, the default runner adds `linux-arm64`, while the build runner adds `startos-build-arm64`. On an ARM64 device, the corresponding suffix is `amd64`. Emulated jobs are slower than native ones.

Labels must use `name:docker://image`. Host-execution labels are not accepted.

### Docker-in-Docker

Use the build runner for Docker-in-Docker workflows. It provides an engine socket from the start of the job. If `docker/setup-docker-action` starts another daemon, its default working directory is backed by build scratch rather than the job's layered root filesystem. Cached images and scratch are excluded from backups.

The ordinary runner deliberately does not provide an engine socket or privileged containers. A job cannot opt into those privileges merely by setting container options.

If a reusable build workflow hard-codes `ubuntu-latest`, either use a workflow that selects `startos-build`, or give `ubuntu-latest` to the build runner and change the ordinary runner to a different label. Never advertise the same label on both.

### Checking out repositories

For the workflow's own Forgejo repository, use the standard checkout action, which authenticates with the job token:

```yaml
- uses: https://github.com/actions/checkout@v4
```

### Replacing a forgotten registration

If Forgejo has been reinstalled or a registration deleted, its health check asks for new credentials. Create a replacement in Forgejo and update **Configure** or **Configure Build Runner**, matching the affected registration. Replacing one registration does not replace the other.
