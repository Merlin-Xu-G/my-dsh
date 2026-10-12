# my-dsh — declarative DSH settings

One repository that makes a DSH (DeepSeek Harness) setup reproducible:
plugins, profile payload, and skills live here as files. A new machine
rebuilds the identical setup with a few steps; `/backup` keeps the repo in
sync with reality afterwards.

## What's in the repo

| Path | What it is |
|---|---|
| `package.json`, `cordis.patch.yml`, `index.js`, `locale/` | The `@local/my-dsh` DSH bundle — provides the `/backup` and `/restore` commands |
| `backup/profiles/<name>/` | Declarative snapshot of each DSH profile: `package.json`, `cordis.patch.yml`, `meta.json` (hashes + versions) |
| `skills/` | DSH skills; `dsh-sync-skills` installs them flat into `~/.dsh/skills` |
| `references/` | Read-only DSH plugin-development docs |
| `AGENTS.md` | Rules for agents working in this repo |

All three custom bundles (`my-dsh`, `dsh-software-factory`, `dsh-memories`)
are referenced as `github:` specs — no machine-local paths anywhere in the
tracked payload.

## New machine setup

1. **Install the DSH app.** It creates the `desktop` profile automatically.
2. **Clone this repo and open a DSH session inside it** — the GitHub add in
   the next step installs only the command bundle; the skills, the restore
   procedures, and the profile backup data all live in this repo, so the
   session must run inside a clone:
   ```bash
   git clone git@github.com:Merlin-Xu-G/my-dsh.git
   ```
3. **Add the my-dsh bundle**: Plugins page → Add plugin →
   `https://github.com/Merlin-Xu-G/my-dsh` (or ask the session agent to run
   `plugin_manager` `install_bundle`). Restart DSH if prompted — the
   `/backup` and `/restore` commands appear.
4. **Run `/restore`** — syncs the skills into `~/.dsh/skills` and installs
   the default plugins (`dsh-software-factory`, `dsh-memories`) from
   GitHub.
5. **Run the `dsh-profile-restore` skill** (ask the agent). It restores the
   profile payload from `backup/profiles/desktop/` — provider/model config,
   UI settings, permission presets, bundle list — after showing a diff and
   asking for confirmation.
6. **Restart DSH** — `/factory`, `/memory`, the memory injection, and the
   factory sidebar tab go live.

`/restore` runs before the profile restore: by the time the restored
manifest lands, every `@local` bundle it names is already installed, so the
profile never lists a bundle it cannot resolve.

One thing is machine-local and never lives in this repo:

- Git identity — without it `/backup`'s commit step fails:
  ```bash
  git config user.name  "Your Name"
  git config user.email "you@example.com"
  ```

## Daily workflow

- **After changing anything in a DSH profile** (plugins, settings): run
  `/backup`. It snapshots every profile into `backup/profiles/`, then
  commits (and pushes when `origin` exists) — each git step asks first.
- **After editing skills in this repo**: re-run the `dsh-sync-skills` skill.
  Installed copies do not self-update.
- **After changing the my-dsh bundle itself** (`index.js`,
  `cordis.patch.yml`): commit and push, then update the installed snapshot —
  remove `@local/my-dsh` and add `https://github.com/Merlin-Xu-G/my-dsh`
  again. A plain re-install reports `ambiguous-install` and leaves the
  lockfile pinned to the old commit.
- **Updating the other plugins**: same pattern — remove the bundle, add the
  GitHub URL again. The profile lockfile pins exact commits, so nothing
  drifts silently.

## Not in the repo, by design

API keys and credentials, `node_modules`, lock files, `cordis.yml`, and
anything else DSH regenerates (see `references/dsh-profile-anatomy.md`).
