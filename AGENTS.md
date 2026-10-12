# AGENTS.md

This repo holds my personal DSH (DeepSeek Harness) settings.

## What this repo is for

The goal is to make my DSH setup **declarative**: every customization lives here as files, not as manual steps or hidden local state. When I move to another PC, these files set up an identical DSH quickly.

## Layout

- `project.yaml` — DSH project marker (`dsh-version`).
- `package.json` / `cordis.patch.yml` / `index.js` / `locale/` — the repo's own DSH bundle (`@local/my-dsh`, row `my-dsh`), providing the `/backup` and `/restore` commands.
- `skills/` — local DSH skills (see below).
- `backup/profiles/<name>/` — declarative backup of each DSH profile: `package.json`, `cordis.patch.yml`, `meta.json` (versions + timestamps + hashes).
- `references/dsh-plugin-development/` — plugin development docs extracted from the DSH app. Read-only reference; see its `INDEX.md`.
- `references/dsh-profile-anatomy.md` — how DSH generates `~/.dsh/profiles` and what upgrades touch.
- `.tmp/` — scratch tooling; not part of the setup.

## Skills

Skills are grouped in the repository: `skills/<group>/<name>/SKILL.md` plus optional `scripts/`, `references/`, `templates/` subdirectories (DSH skills live in `skills/dsh/`; more groups may follow). `dsh-sync-skills` installs them **flat** into `~/.dsh/skills/<name>/` — DSH discovery is one level deep — so skill names must be unique across all groups.

**Creating a skill:**
- Frontmatter: `name` (kebab-case, matches the directory, ≤64 chars) and `description` (required, third person, states what it does and when to use it); optional `whenToUse`.
- Provenance: every skill carries a `metadata` block in its frontmatter — `createdAt`, `createdDshVersion`, `lastUpdatedAt`, `lastUpdatedDshVersion`. Set the creation pair once when authoring; refresh the last-update pair (timestamp + current DSH version via the shared helper) on every edit.
- Body = executable instructions for an agent: concrete steps, exact paths, decision rules, and safety constraints. Keep it deterministic — another agent must produce the same result.
- Shared helper scripts live once in `skills/dsh/scripts/` (a plain directory, never a skill — no SKILL.md). `dsh-sync-skills` mirrors it to `$DSH_HOME/my-dsh-lib/scripts/`, and skills hardcode that installed path (`$DSH_HOME/my-dsh-lib/scripts/<file>`, default `~/.dsh/my-dsh-lib/scripts/<file>`); keep a `dsh --version`-style fallback for pre-sync machines. Never copy helper scripts into individual skills.
- Existing skills: `dsh-profile-backup` (snapshot `~/.dsh/profiles` payloads into `backup/profiles/` with version metadata), `dsh-profile-restore` (apply them back after confirmation), and `dsh-sync-skills` (copy repo skills into `~/.dsh/skills` and the shared library into `~/.dsh/my-dsh-lib`, without touching foreign skills).

**Installing skills to the local DSH:** run `dsh-sync-skills` — it copies each repo skill into the user skill root (`~/.dsh/skills`), which DSH scans natively, and records repo-owned copies in `~/.dsh/skills/.dsh-sync-manifest.json`; anything not in the manifest is foreign and is never modified or removed. Copies do not self-update: re-run `dsh-sync-skills` after editing skills in the repo. New conversations pick up catalog changes automatically (a running conversation's catalog does not refresh). DSH also scans `<repo>/.dsh/skills` and `<repo>/.agents/skills` for sessions opened inside this repo.

## Rules for agents

- Keep everything declarative: express changes as files (bundle `package.json`, `cordis.patch.yml`, configs), never as manual UI steps.
- Install bundles with the `plugin_manager` tool (`install_bundle`); do not hand-write files under `$DSH_PROFILE` or `$DSH_HOME` — the one exception is `dsh-profile-restore`, which is the sanctioned writer of a profile's `package.json` and `cordis.patch.yml`, and only after explicit user confirmation.
- No machine-specific absolute paths in tracked files.
- Before writing any plugin or patch, read `references/dsh-plugin-development/INDEX.md` first.
- After changing a profile's payload, offer to run `dsh-profile-backup` so `backup/profiles/` and reality stay in sync.
- `/backup` and `/restore` (from the `@local/my-dsh` bundle) are the sanctioned interactive paths for the backup/sync procedures; the git steps they drive always ask first. Bundle-row config for this plugin (e.g. the machine-local `plugins` list) belongs in the profile's `cordis.patch.yml` override, not in tracked files.
