---
name: dsh-sync-skills
description: Copies skills from this repository's skills/ directory into the local DSH user skill root (~/.dsh/skills), tracking repo-owned copies in a manifest so skills created by other apps or by hand are never touched. Use when the user asks to sync, install, or update local DSH skills from the repo, or after adding, editing, or renaming a skill in skills/.
metadata:
  createdAt: "2026-10-10T15:45:00+08:00"
  createdDshVersion: "0.2.0-rc.2"
  lastUpdatedAt: "2026-10-10T16:40:00+08:00"
  lastUpdatedDshVersion: "0.2.0-rc.2"
---

# DSH skill sync

Copy every skill from this repository's grouped `skills/` tree into the
local DSH user skill root (`$DSH_HOME/skills`, default `~/.dsh/skills`),
which DSH scans natively — **installing them flat**: `skills/<group>/<name>/`
becomes `~/.dsh/skills/<name>/`, because DSH discovery is one level deep.
Copies are byte-identical to the repository, so they must be re-synced after
repo edits — unlike links, they do not update themselves.

**Prime directive: never drop or modify a skill this repository does not
own.** The user skill root may contain skills created by other apps or by
hand; they must survive every sync untouched.

## Ownership: the sync manifest

`<root>/.dsh-sync-manifest.json` is the single record of what this repo
owns. A skill directory is **repo-owned** exactly when its name appears in
the manifest's `skills` map; everything else in the root is **foreign**.
The manifest is machine-local state (not committed) and may hold absolute
paths.

```json
{
  "managedBy": "dsh-sync-skills",
  "repo": "D:\\...\\my-dsh\\skills",
  "skills": {
    "dsh-profile-backup": {
      "syncedAt": "2026-10-10T15:52:00+08:00",
      "dshVersion": "0.2.0-rc.2",
      "files": { "SKILL.md": "sha256:..." }
    }
  },
  "library": {
    "syncedAt": "2026-10-10T16:32:00+08:00",
    "dshVersion": "0.2.0-rc.2",
    "dir": "my-dsh-lib",
    "files": { "scripts/dsh-version.js": "sha256:..." }
  }
}
```

## Steps

1. **Resolve paths.** `<repo>` is the nearest `.git` ancestor of this skill
   file; source is `<repo>/skills`. Target root is `$DSH_HOME/skills`;
   create it if missing. Read the manifest, or start `{ "managedBy":
   "dsh-sync-skills", "skills": {}, "library": null }` when absent.
   Determine the DSH version with `dsh --version` or
   `node $DSH_HOME/my-dsh-lib/scripts/dsh-version.js`.
2. **Enumerate repo skills.** The repo groups skills: `<repo>/skills` holds
   one directory per group (e.g. `dsh/`), and every group child directory
   containing `SKILL.md` is a skill (`skills/<group>/<name>/SKILL.md`).
   Directories without `SKILL.md` — such as `skills/dsh/scripts/`, the
   shared script library — are not skills; the library is handled in step 5.
   Skill names must be unique across all groups, because they all install
   flat into one target root.
3. **Sync each repo skill**:
   - Compute the source file map: relative path → sha256 for every file.
   - **Managed** (name in manifest): if the file map equals the manifest's,
     report unchanged; otherwise replace the directory with a fresh copy
     (remove the directory, then copy recursively) and update the manifest
     entry. Repo-owned directories are mirrored exactly — stale files inside
     them are removed.
   - **New** (not in manifest, no existing directory of that name): copy
     recursively and register in the manifest.
   - **Collision** (not in manifest, but a directory of that name exists):
     FOREIGN — never touch it; report a name conflict and ask the user how
     to proceed before doing anything.
4. **Clean up orphans**: manifest entries whose skill no longer exists in
   the repo. If the on-disk directory's file map still equals the recorded
   one, remove the directory and the manifest entry (it is this repo's own
   artifact). If it diverged, someone edited the copy by hand — report and
   ask instead of deleting.
5. **Sync the shared script library**: mirror `<repo>/skills/dsh/scripts/**`
   into `$DSH_HOME/my-dsh-lib/scripts/` (create it if missing; remove stale
   files so the target mirrors the source exactly). `my-dsh-lib` is this
   repository's namespaced library directory — never touch anything else
   under `$DSH_HOME`. Skills hardcode this path in their instructions.
6. **Write the manifest** back (update `repo`, per-skill `syncedAt`,
   `dshVersion`, and `files`; record the library under `library` with the
   same fields, relative to `my-dsh-lib`).
7. **Report** a table: skill | action (copied / unchanged / conflict /
   foreign left alone / orphan removed), plus one line for the library
   (copied / unchanged), then list untouched foreign skills
   by name. Remind the user that new conversations pick up catalog changes;
   a running conversation does not refresh its skill catalog. Recommend
   re-running this skill after editing skills in the repo, since copies do
   not self-update.

## Rules

- Ownership comes only from the manifest; when in doubt, treat anything as
  foreign and ask.
- Never delete, overwrite, rename, or edit a foreign skill, including
  foreign broken links.
- Copies must stay byte-identical to the repo source; never transform
  content during copy.
- Determinism: two runs with the same repo and root must produce the same
  end state and the same report.
- If the manifest is lost, previously managed copies become foreign by
  rule; report them as conflicts and let the user decide.
