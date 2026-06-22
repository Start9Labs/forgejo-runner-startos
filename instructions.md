# Forgejo Runner

This service runs CI/CD jobs (Forgejo Actions) for the **Forgejo** instance on this device. Install and start Forgejo first — this runner depends on it.

## Setup

1. **Get a registration token** from your Forgejo instance: **Site / Organization / Repository Settings → Actions → Runners → Create new Runner**. Copy the token it shows.
2. Open this service's **Actions → Configure**:
   - **Registration Token** — paste the token from step 1.
   - **Runner Name**, **Labels**, **Concurrent Jobs** — adjust if needed. The default `ubuntu-latest` label runs jobs in a standard Ubuntu image.
   - Save.
3. **Start (or restart)** the service. It registers with your Forgejo and begins picking up jobs — you should see the runner appear as **Online** in Forgejo's Runners list.

> Saving Configure re-registers on the next restart, so provide a **fresh** token each time you reconfigure (registration tokens are single-use).

## Labels and architecture

Labels decide which jobs this runner accepts (a workflow's `runs-on:`). Adding a foreign-architecture label also lets this runner serve **emulated** jobs — these work but are **much slower** than native. For regular multi-arch builds, run a separate runner on native hardware for each architecture and reserve emulation for architectures you have no native hardware for.

## Requirements

The **Forgejo** service must be installed and running on this device. A CI runner also needs real headroom: this service requires at least **2 GiB RAM and 2 CPU cores**, and real-world CI builds can use considerably more.
