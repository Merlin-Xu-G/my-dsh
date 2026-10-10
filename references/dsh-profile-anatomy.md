# DSH profile anatomy — how `~/.dsh/profiles/<name>/` is generated

Verified against the installed app (`app.asar`: `@deepseek-ai/dsh-app-boot/lib/index.js`,
`@deepseek-ai/dsh/lib/profile-boot-BZ2ZjNWi.js`, Electron `lib/main.js`) on 2026-10-10.

## Files in a profile directory

| File | Written by | When | Rewritten later? |
|---|---|---|---|
| `package.json` | `initProfile()` | first load of the profile, only if missing | Only by plugin-manager bundle toggles, or `normalizeShippedProfile` migration (see below) |
| `cordis.patch.yml` | `initProfile()` from `PROFILE_PATCH_TEMPLATE` (comment header + `[]`) | first load, only if missing | **Never** — the only later writer is the plugin manager appending overrides |
| `pnpm-workspace.yaml` | `initProfile()` from `PROFILE_PNPM_WORKSPACE` | first load, only if missing | Never |
| `cordis.yml` | `dsh` CLI `prepareProfile()` from `PROFILE_ROOT_CONFIG` | every boot | **Yes — unconditionally regenerated**; it is a fixed `[]` root, "Edit cordis.patch.yml, not this file" |
| `node_modules/` | pnpm (bundle installs) + app refresh | on bundle install / app upgrade | Refreshed on app upgrades |

`initProfile` contract (app-boot source): "Existing files are never touched, so re-running
is a no-op on an initialized profile."

## Which profiles exist, and who creates them

- `PROFILE_TEMPLATES` (built into dsh-app-boot, copied into the Electron main):
  - `acp` = [dsh-base, dsh-acp-app]
  - `web` = [dsh-base, dsh-web-app]
  - `headless` = [dsh-base, dsh-headless]
  - `sdk` = [dsh-base, dsh-sdk-app]
  - `sdk-minimal` = [dsh-sdk-minimal]
- The **desktop app** hard-wires its profile to `~/.dsh/profiles/desktop` (Electron
  `lib/main.js` line 70) and seeds it via `createPluginProfile()` →
  `initProfile(dir, PROFILE_TEMPLATES.web.bundles)` under a PID lock file (`profiles/desktop/lock`).
  So `desktop` starts as a copy of the `web` template.
- Unknown profile names are NOT auto-created; `dsh plugin --profile <name> add <pkg>` creates
  them with `DEFAULT_PROFILE_BUNDLES = [@deepseek-ai/dsh-base]`.
- Optional bundles (`dsh-experimental-agent-team-profile`, `-voice-input-bundle`,
  `-auto-review`, `-schedule-bundle`) are shipped in the installation, off by default;
  enabling them appends to `package.json`'s `dsh.profile.bundles` (what happened on this machine).

## Layer order (what composes over the empty `cordis.yml` root)

1. Each bundle in `package.json` → `dsh.profile.bundles`, in order — each bundle's own
   `cordis.patch.yml` ships inside the dsh installation (`app.asar`).
2. The profile's `cordis.patch.yml` (your layer; this is where the settings UI and plugin
   manager append id-targeted overrides — e.g. the `llm-pi-ai` GLM provider rows and
   `agent-default-model` on this machine).
3. `$DSH_HOME/cordis.patch.yml` — machine-local home patch above all profiles.
4. Any `--patch` invocation overlays.

## Upgrade semantics (DSH app update)

- In-box bundle packages (`@deepseek-ai/dsh-base`, `dsh-web-app`, …) resolve
  **installation-first** (`resolveBundleDir`: the dsh app's anchor before the profile dir),
  so after an app upgrade the same bundle names resolve to the new installation — shipped
  plugin code and their patch rows update with the app.
- The profile scaffold (`cordis.patch.yml`, `package.json`, `pnpm-workspace.yaml`) is never
  overwritten; `normalizeShippedProfile` rewrites the manifest bundle list only when it
  exactly matches a registered installation-owned tuple (today: only `headless`) —
  user-modified lists are preserved.
- `cordis.yml` is regenerated from the constant on every boot anyway.
- Profile-installed external bundles keep their installed versions until you update them.

## Implication for this repo (declarative setup)

The declarative payload of a machine is exactly: the profile `package.json` bundle list +
the profile `cordis.patch.yml` (+ any locally installed bundle sources). Everything else is
installation-owned and regenerates. Copy/sync those two files per profile to reproduce a DSH
setup on a new PC.
