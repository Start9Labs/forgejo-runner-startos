# TODO

- Sibling package: `gitea-runner-startos` (Gitea). Was near-identical, but now diverges: Gitea's act_runner is not on the v12 connection model (keeps `register`) and has no emulation toggle (act_runner 1.0.8 lacks the `?platform=` label option).
- SDK 2.0: swap `nestedRuntime: true` back to `userspaceFilesystems: true` + `virtualNetworking: true` when the registry moves to SDK 2.0 (1.5.3 has the combined `nestedRuntime` flag).
