# TODO

- Translate in-app strings (currently English-only; see `startos/i18n/dictionaries/translations.ts`).
- Add a dedicated "enable emulation" toggle that appends foreign-arch labels (today emulation is opt-in by adding arch labels manually).
- Add `CONTRIBUTING.md` per the four-file template.
- Sibling package: `act-runner-startos` (Gitea), near-identical to this one.
- Health check: `ready` keys off the store token (set by Configure), so a runner registered out-of-band shows red despite working. Key it off `.runner` / live forge connectivity instead. (Cooldown trigger added to stop the per-second log spam.)
- Migrate off the deprecated `forgejo-runner register` (deprecated in v12) to declaring the connection in `config.yaml` (the multi-connection model).
- SDK 2.0: swap `nestedRuntime: true` back to `userspaceFilesystems: true` + `virtualNetworking: true` when the registry moves to SDK 2.0 (1.5.3 has the combined `nestedRuntime` flag).
