# AGENTS.md

This is a StartOS service-package repository — it builds a `.s9pk` for StartOS.

Develop it inside a StartOS packaging workspace created by `start-cli s9pk init-workspace`,
which provides the packaging guide and agent context one level up. If you're reading this in a
bare clone with no workspace, the full guide is at <https://docs.start9.com/packaging>.

**Start every task at the recipe index** — `../start-technologies/projects/start-sdk/docs/src/recipes.md`
(or <https://docs.start9.com/packaging/recipes.html>). It maps an intent ("prompt the user to create
admin credentials", "expose a web UI") to the constructs, the reference pages, and a named production
package to copy. Find the recipe before you read this package's neighbours: a package you reach by
grepping may be non-conformant, and the recipe outranks it.

Freshly scaffolded? Work the
[New Package Checklist](../start-technologies/projects/start-sdk/docs/src/new-package-checklist.md)
(or <https://docs.start9.com/packaging/new-package-checklist.html>) from top to bottom. It is a
guide page, not a file in this repo — read it, don't copy it in.

Keep `README.md` (technical reference for an AI support or administering agent) and
`instructions.md` (end-user docs) in sync with your changes.

**Bugs and feature requests are GitHub issues on this repo** — file them as you find them.
Don't record work in the repo instead: no `TODO.md`, no `NOTES.md`, no `PLAN.md`. What you
verified, tried, and decided belongs in the commit message and the PR body.

## This repo

- **`git` in the image is load-bearing.** The runner fetches `uses:` actions with the git CLI, so without it every `uses:` step fails at fetch time with an exec error rather than anything that names the cause.
- **The `subuid`/`subgid` range must start above the `app` user's own uid and stay inside the subcontainer's userns.** `app` is uid 1000 and the range is 1001–65535 for that reason; overlapping or exceeding it breaks nested user namespaces.
- **`clean-runtime` requires `own-data`, not `[]`.** Chain entries with no requirements run concurrently, and `own-data`'s `chown -R` walks the tree `clean-runtime` deletes. Racing them fails the chown with ENOENT, so `own-data` reports failure and retries before it succeeds — log noise for nothing.
- **A daemon's `ready.fn` overwrites the crash status the SDK sets when the process exits.** So a `fn` that reports on stored configuration paints a crash loop green on its next poll — `primary`'s check has to observe the process itself.
- **`own-data` chowns only `runner/`, not the volume root.** StartOS's `store.json` lives at the same mount and must keep its own ownership.
- **Foreign-architecture labels must carry the `?platform=` pin**, which is why the emulation toggle composes the label rather than asking the user to type one. A hand-written arch label runs the job natively and fails confusingly.
