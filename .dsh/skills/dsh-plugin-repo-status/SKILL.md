---
name: dsh-plugin-repo-status
description: Reports the status of the user's DSH plugin repositories in one table — per repo the uncommitted changes, unpushed commits, remote branches with no PR yet, and leftover branches from closed PRs classified as merged or unmerged. Use when the user asks for a repo status report, a leftover-branch review, or what still needs committing, pushing, or PR-ing across the DSH plugin repos.
metadata:
  createdAt: "2026-10-22T03:31:46+00:00"
  createdDshVersion: "0.2.1-rc.2"
  lastUpdatedAt: "2026-10-26T01:40:40+00:00"
  lastUpdatedDshVersion: "0.2.1-rc.2"
---

# DSH plugin repo status

Produce one status table covering the four DSH plugin repositories — this
settings repo plus its three sibling plugin repos. Everything is read-only;
the report only describes state and never changes it.

## Scope

- `<repo>` is the nearest `.git` ancestor of this skill file (my-dsh).
- Repos, in fixed report order: `<repo>`, `<repo>/../dsh-memories`,
  `<repo>/../dsh-software-factory`, `<repo>/../dsh-git-actions`. A missing
  sibling is reported as missing; never scan the parent for other repos.

## Steps

1. **Refresh remote state.** For each repo run `git -C <path> fetch origin`
   so ahead/behind and branch comparisons use fresh refs, not stale ones.
2. **Local state per repo:**
   - branch: `git -C <path> branch --show-current`
   - uncommitted: `git -C <path> status --short` (empty → clean)
   - upstream: `git -C <path> rev-parse --abbrev-ref --symbolic-full-name @{u}`;
     a failure means the branch has no remote branch of its own
   - unpushed commits: with upstream `git rev-list --count @{u}..HEAD`;
     without upstream `git rev-list --count origin/main..HEAD`, marked
     "local only — no remote branch, no PR"
3. **Open PRs.** Owner/name come from `git remote get-url origin` (strip an
   `https://github.com/` or `git@github.com:` prefix and the `.git`
   suffix). For each repo run
   `gh pr list -R <owner>/<name> --state open --json number,headRefName` and
   `gh pr list -R <owner>/<name> --state closed --json number,headRefName,mergedAt --limit 50`
   (closed includes merged; `mergedAt` set ⇔ merged — this supplies PR
   state and numbers for leftover classification). If `gh` is
   missing or unauthenticated, mark PR data "unverified" and classify
   branches by merge state alone.
4. **Split every remote branch except `origin/HEAD` and `origin/main` that
   is not the head of an open PR** by PR state:
   - **No PR at all** → **PR not opened yet** (column 4; never a leftover):
     report the branch with its last commit date
     (`git log -1 --format=%cs origin/<branch>`); when
     `git diff origin/main origin/<branch> --shortstat` is empty, append
     "content already on main".
   - **Head of a closed PR** (newest PR for the branch wins) → **leftover**,
     decided in order:
      1. that PR has `mergedAt` set → **✅ merged leftover** with that PR
         number (PR state is authoritative: a squash-merged branch can
         fail every patch test yet be merged — note when tests disagree)
      2. listed by `git branch -r --merged origin/main` →
         **✅ merged leftover**
      3. `git diff origin/main origin/<branch> --shortstat` is empty
         (content identical to main) → **✅ merged leftover**
      4. `git cherry origin/main origin/<branch>` prints only lines
         starting with `-` (patch-equivalent commits on main) →
         **✅ merged leftover** (squash-merged)
      5. otherwise → **⚠️ unmerged**: add its last commit date and the
         two-dot shortstat `git diff origin/main origin/<branch> --shortstat`
5. **Report ONE table**, one row per repo in the fixed order, columns
   exactly:

   | Repo (`branch`) | Uncommitted | Unpushed | Pushed but no open PR | Leftover |

   - **Uncommitted**: `— clean` or the file list (paths linked relative to
     that repo).
   - **Unpushed**: `— none` or `N commits (+ M dirty files)`; append the
     "local only" marker when the branch has no upstream.
   - **Pushed but no open PR**: branches with no PR ever opened ("not open
     yet" — branches whose PR is closed do NOT belong here), one per line
     as `<branch> — YYYY-MM-DD` (last-commit date); no ✅/⚠️ tags — those
     are leftover-only.
   - **Leftover**: one branch per line (`✅ <branch> — PR #N` or
     `⚠️ <branch> — YYYY-MM-DD`), then
     `A merged / B unmerged → ✅ delete OK · ⚠️ review first`.

   Under the table: the legend (✅ merged leftover — content on main, safe
   to delete; ⚠️ unmerged leftover — PR closed without merging, review
   first) and a totals line: merged leftovers, unmerged stale branches, and
   live unmerged workstreams (repos with uncommitted work, unpushed
   commits, or pushed branches with no PR yet).

## Rules

- Read-only everywhere: never commit, push, delete branches, create or
  close PRs, or modify any file in the repos; `git fetch` (step 1) is the
  only remote-touching command.
- Determinism: same day's data must produce the same table — fixed repo
  order, fixed columns, classification by the ordered tests in step 4.
- No machine-specific absolute paths: resolve repos relative to this skill
  file's repo and derive remotes from `git remote get-url origin`.
- Describe, don't act: cleanup suggestions stay suggestions until the user
  explicitly asks for them.
