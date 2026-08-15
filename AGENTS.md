# AGENTS.md

This is a StartOS service-package repository — it builds a `.s9pk` for StartOS.

Develop it inside a StartOS packaging workspace created by `start-cli s9pk init-workspace`,
which provides the packaging guide and agent context one level up. If you're reading this in a
bare clone with no workspace, the full guide is at <https://docs.start9.com/packaging>.

Work this package's `TODO.md` from top to bottom. Keep `README.md` (the package's technical reference — the only one an AI support or administering agent reads) and `instructions.md` (end-user docs) in sync with your changes.

## This repo

- **`userspaceFilesystems` and `virtualNetworking` are both required, and neither is optional.** The rootless Podman engine needs `/dev/fuse` for its storage driver and `/dev/net/tun` for job networking; dropping either leaves jobs failing at container start. See the packaging guide's nested-OCI-runtime recipe.
- **`git` in the image is load-bearing.** The runner fetches `uses:` actions with the git CLI, so without it every `uses:` step fails at fetch time with an exec error rather than anything that names the cause.
- **The `subuid`/`subgid` range must start above the `app` user's own uid and stay inside the subcontainer's userns.** `app` is uid 1000 and the range is 1001–65535 for that reason; overlapping or exceeding it breaks nested user namespaces.
- **`own-data` chowns only `runner/`, not the volume root.** StartOS's `store.json` lives at the same mount and must keep its own ownership.
- **Foreign-architecture labels must carry the `?platform=` pin**, which is why the emulation toggle composes the label rather than asking the user to type one. A hand-written arch label runs the job natively and fails confusingly.
- **Bump the `Dockerfile`'s runner tag and `versions/current.ts` together.** The image is the only place the upstream version appears.
