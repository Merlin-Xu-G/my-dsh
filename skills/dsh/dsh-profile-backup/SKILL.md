---
name: dsh-profile-backup
description: Backs up every DSH profile's declarative payload (package.json and cordis.patch.yml) from the local ~/.dsh/profiles into this repository's backup/profiles directory, recording the DSH version and timestamps in meta.json. Use when the user asks to back up, save, or snapshot their DSH profiles, settings, or configuration, or before migrating to another PC.
metadata:
  createdAt: "2026-10-10T15:10:44+08:00"
  createdDshVersion: "0.2.0-rc.2"
  lastUpdatedAt: "2026-10-10T16:32:00+08:00"
  lastUpdatedDshVersion: "0.2.0-rc.2"
---

# DSH profile backup

Back up the declarative part of every DSH profile on this machine into this
repository, so a new PC can reproduce the setup. A profile's declarative
payload is exactly two files; everything else regenerates from the DSH
installation (see `references/dsh-profile-anatomy.md` in the repository root).

## Steps

1. **Locate profiles.** `$DSH_HOME` (default `~/.dsh`) → `<home>/profiles`.
   Every child directory that contains `package.json` is a profile; skip
   `node_modules` and non-directories.
2. **Determine the DSH version.** Try `dsh --version` first. If dsh is not on
   PATH, run `node $DSH_HOME/my-dsh-lib/scripts/dsh-version.js` (default
   `~/.dsh/my-dsh-lib/scripts/dsh-version.js`; get the node executable from
   load_workspace_dependencies). Record the exact version string, e.g.
   `0.2.0-rc.2`.
3. **Copy the payload** byte-for-byte into `<repo>/backup/profiles/<profile>/`
   where `<repo>` is the nearest `.git` ancestor of this skill file:
   - `package.json` (the profile manifest with `dsh.profile.bundles`)
   - `cordis.patch.yml` (the user patch layer; a missing file is an error to
     report, not to invent)
4. **Maintain `meta.json`** in the same backup directory. Compute the sha256
   of each copied file (PowerShell `Get-FileHash -Algorithm SHA256`).
   - No meta.json yet → create it; creation and last-update fields describe
     this run.
   - Existing meta.json → preserve `createdAt` and `createdDshVersion`
     verbatim; always refresh the check fields; refresh the last-update fields
     only when a file hash changed.

   ```json
   {
     "profile": "desktop",
     "createdAt": "2026-10-10T15:10:00+08:00",
     "createdDshVersion": "0.2.0-rc.2",
     "lastUpdatedAt": "2026-10-10T15:10:00+08:00",
     "lastUpdatedDshVersion": "0.2.0-rc.2",
     "lastCheckedAt": "2026-10-10T15:10:00+08:00",
     "dshVersionAtLastCheck": "0.2.0-rc.2",
     "files": {
       "package.json": "sha256:<hash>",
       "cordis.patch.yml": "sha256:<hash>"
     }
   }
   ```

   Timestamps are ISO 8601 with local UTC offset.
5. **Report** a table: profile | payload changed? | created (version) |
   last updated (version) | this check's version. Also list profiles that
   exist in `backup/profiles/` but no longer on the machine — leave them
   untouched and flag them as stale.

## Rules

- Read-only with respect to the machine: never write anything under
  `$DSH_HOME` while backing up.
- Payload files are copied verbatim; never reformat, reorder, or merge.
- Do not back up `node_modules`, `cordis.yml`, `pnpm-workspace.yaml`, or
  lock files: they are installation-owned or regenerable.
