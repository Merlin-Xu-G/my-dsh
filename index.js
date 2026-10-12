/**
 * @local/my-dsh — Host half of the settings repository's own bundle.
 *
 * Registers two human commands that steer procedure prompts into the
 * session's agent (the same mechanism `@deepseek-ai/dsh-plan-mode` uses for
 * `/plan [message]` and that `@local/dsh-software-factory` uses for
 * `/factory <request>`):
 *
 * - `/backup [note]` — snapshot every DSH profile's declarative payload
 *   into `backup/profiles/` exactly per `skills/dsh/dsh-profile-backup/
 *   SKILL.md`, then inspect `git status --porcelain`, warn about any
 *   changes outside `backup/` before proceeding, commit only `backup/`
 *   with the canonical message, and push to origin when `autoPush` is on
 *   and an origin remote exists — every git action behind an explicit
 *   user confirmation; a decline stops the run cleanly.
 * - `/restore [note]` — install the repository's skills exactly per
 *   `skills/dsh/dsh-sync-skills/SKILL.md`, then install each configured
 *   plugin through `plugin_manager` `install_bundle`, then report the
 *   DSH-restart caveat for replaced module generations.
 *
 * The procedures live in the skill files (referenced by repo-relative
 * path: the session running these commands has this repository as its
 * workspace); the prompts below encode the orchestration and the safety
 * gates, and deliberately do not duplicate the skills' internals beyond
 * their hard rules.
 *
 * Contracts coded against (verified against the installed Harness, same
 * inspection round as @local/dsh-software-factory):
 * - `ctx.commands.register({ name, description, input: { hint },
 *    recordInput, handler })` from the `commands` service
 *    (@deepseek-ai/dsh-commands); the handler receives
 *    `{ agent, rawInput, attachments, signal }`, is awaited, and returns
 *    `{ kind: 'success', text? }` or `{ kind: 'error', text }`.
 * - `agent.steer(userMessage)` (dsh-agent-loop) inserts the message for
 *    the next step AND wakes the driver; the message shape matches
 *    dsh-llm's `createUserMessage` (`{ role: 'user', content, source:
 *    { kind: 'user' }, id }`, deep-frozen — the id brand is a compile-time
 *    no-op).
 * - `ctx.inject(['commands'], callback)` (cordis) returns the fiber whose
 *    `dispose()` is this plugin's cleanup; the plugin stays dormant in
 *    profiles without the command surface.
 * - `export const Config` implements the Standard Schema `~standard`
 *    protocol cordis `resolveConfig` calls — dependency-free.
 */
import { randomUUID } from 'node:crypto';

/** Repo-relative procedure files the prompts defer to (the session workspace is this repository). */
const BACKUP_SKILL = 'skills/dsh/dsh-profile-backup/SKILL.md';
const SYNC_SKILLS_SKILL = 'skills/dsh/dsh-sync-skills/SKILL.md';

const CONFIG_KEYS = new Set(['plugins', 'autoPush']);

/**
 * Recursively freeze plain data in place, mirroring dsh-llm's immutable
 * message invariant.
 * @param {unknown} value
 * @returns {unknown} the same reference, frozen.
 */
function deepFreeze(value) {
  if (value !== null && (typeof value === 'object' || Array.isArray(value))) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Validate and normalize the plugin config. Unknown keys fail at
 * activation so typos never silently disable a step.
 *
 * @param {unknown} input raw row config; `{}`/`undefined` selects defaults.
 * @returns {Readonly<{plugins: readonly string[], autoPush: boolean}>}
 */
function resolveConfig(input) {
  const raw = input === undefined || input === null ? {} : input;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('my-dsh config must be an object');
  }
  const unknown = Object.keys(raw).filter((key) => !CONFIG_KEYS.has(key));
  if (unknown.length > 0) {
    throw new Error(
      `my-dsh config has unknown key(s) ${unknown.join(', ')} — allowed keys: ${[...CONFIG_KEYS].join(', ')}`,
    );
  }
  const plugins = raw.plugins === undefined ? [] : raw.plugins;
  if (
    !Array.isArray(plugins)
    || plugins.some((entry) => typeof entry !== 'string' || entry.trim() === '')
  ) {
    throw new TypeError('my-dsh config "plugins" must be an array of non-empty strings (plugin_manager install_bundle targets)');
  }
  const autoPush = raw.autoPush === undefined ? true : raw.autoPush;
  if (typeof autoPush !== 'boolean') {
    throw new TypeError('my-dsh config "autoPush" must be a boolean');
  }
  return Object.freeze({ plugins: Object.freeze([...plugins]), autoPush });
}

/**
 * The plugin's Config schema (Standard Schema `~standard.validate`), the
 * exact protocol cordis `resolveConfig` calls. Dependency-free; configure
 * via the patch row.
 */
export const Config = {
  '~standard': {
    version: 1,
    vendor: '@local/my-dsh',
    validate(raw) {
      try {
        return { value: resolveConfig(raw) };
      } catch (error) {
        return {
          issues: [
            {
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        };
      }
    },
  },
};

/**
 * Build the `/backup` procedure prompt.
 * @param {ReturnType<resolveConfig>} resolved validated config.
 * @param {string} note optional free-form user note ('' when absent).
 * @returns {string} markdown prompt.
 */
export function buildBackupPrompt(resolved, note) {
  const lines = [];
  lines.push('# my-dsh backup run');
  lines.push('');
  lines.push(
    'You are performing the declarative-backup routine for this repository (the session workspace — the my-dsh settings repository). Work through the steps in order. Every git action is behind an explicit user confirmation; a decline stops the run cleanly at that point, leaving completed non-git work on disk. Never force any step.',
  );
  if (note !== '') {
    lines.push('');
    lines.push(`User note for this run: ${note}`);
  }
  lines.push('');
  lines.push(`## Step 1 — Back up the DSH profiles`);
  lines.push('');
  lines.push(
    `Follow \`${BACKUP_SKILL}\` exactly: read that file first, then execute its procedure verbatim — locate the profiles under \`$DSH_HOME/profiles\` (default \`~/.dsh\`), determine the DSH version (\`dsh --version\`, or \`node $DSH_HOME/my-dsh-lib/scripts/dsh-version.js\`), copy each profile's \`package.json\` and \`cordis.patch.yml\` byte-for-byte into \`backup/profiles/<profile>/\`, maintain \`meta.json\` with its sha256/timestamp/version discipline, and produce the skill's report table including stale backup entries.`,
  );
  lines.push('');
  lines.push('Hard rules from the skill, restated because they are absolute:');
  lines.push('');
  lines.push('- Never write anything under `$DSH_HOME` during the backup.');
  lines.push('- Payload files are copied verbatim; never reformat, reorder, or merge.');
  lines.push('- A profile `cordis.patch.yml` that is missing is an error to report, not a file to invent.');
  lines.push('- Never back up `node_modules`, `cordis.yml`, `pnpm-workspace.yaml`, or lock files.');
  lines.push('');
  lines.push(
    'Record the DSH version string determined in this step — the commit message in step 3 uses it.',
  );
  lines.push('');
  lines.push('## Step 2 — Inspect the repository state');
  lines.push('');
  lines.push(
    'Run `git status --porcelain` at the repository root and classify every listed path:',
  );
  lines.push('');
  lines.push('- `backup/**` — the expected output of step 1;');
  lines.push('- anything else — unexpected changes, which will NOT be committed.');
  lines.push('');
  lines.push(
    'If any path outside `backup/` is listed, ask the user (ask_user_question) before proceeding, listing those paths verbatim and stating explicitly that only `backup/` will be staged and committed. On decline, stop after the backup: commit nothing, leave everything on disk, and report where you stopped.',
  );
  lines.push('');
  lines.push(
    'If nothing at all changed, report that no commit is needed and stop after reporting the backup summary.',
  );
  lines.push('');
  lines.push('## Step 3 — Commit the backup');
  lines.push('');
  lines.push(
    'Ask the user to confirm the commit, showing the exact commit message. On decline, stop after the backup.',
  );
  lines.push('');
  lines.push(
    'On approval run exactly `git add backup/` and then `git commit -m "backup: profiles <ISO date> (dsh <dsh version>)"`, where `<ISO date>` is today\'s local date as `YYYY-MM-DD` and `<dsh version>` is the version string recorded in step 1. Stage nothing else; never use `git add -A` or `git add .`.',
  );
  lines.push('');
  lines.push('## Step 4 — Push');
  if (resolved.autoPush) {
    lines.push('');
    lines.push(
      'Auto-push is enabled for this run. Check `git remote`: when a remote named origin exists, ask the user to confirm the push (a separate confirmation from the commit); on decline stop after the commit. On approval push the current branch to origin (determine it with `git branch --show-current`). When no origin remote exists, say that pushing was skipped for that reason.',
    );
  } else {
    lines.push('');
    lines.push(
      'Auto-push is disabled by configuration (`autoPush: false`): do not push, and note that in the final report.',
    );
  }
  lines.push('');
  lines.push('## Final report');
  lines.push('');
  lines.push(
    'End with a short summary: what the backup changed, the commit hash (or that no commit was made), the push outcome (pushed / declined / no origin / disabled), and — if the run stopped early — exactly where it stopped and what was left on disk.',
  );
  lines.push('');
  return lines.join('\n');
}

/**
 * Build the `/restore` procedure prompt.
 * @param {ReturnType<resolveConfig>} resolved validated config.
 * @param {string} note optional free-form user note ('' when absent).
 * @returns {string} markdown prompt.
 */
export function buildRestorePrompt(resolved, note) {
  const lines = [];
  lines.push('# my-dsh restore run');
  lines.push('');
  lines.push(
    'You are performing the declarative-restore routine for this machine from this repository (the session workspace — the my-dsh settings repository): sync the skills, then install the configured plugins. Stop cleanly at the first failure or decline and report exactly where you stopped.',
  );
  if (note !== '') {
    lines.push('');
    lines.push(`User note for this run: ${note}`);
  }
  lines.push('');
  lines.push('## Step 1 — Install the skills');
  lines.push('');
  lines.push(
    `Follow \`${SYNC_SKILLS_SKILL}\` exactly: read that file first, then execute its procedure verbatim — resolve \`<repo>\` as the nearest \`.git\` ancestor of that skill file, copy every repo skill flat into \`$DSH_HOME/skills\` (one level deep), maintain \`.dsh-sync-manifest.json\` ownership, mirror the shared library \`skills/dsh/scripts/**\` into \`$DSH_HOME/my-dsh-lib/scripts/\`, and produce the skill's report table.`,
  );
  lines.push('');
  lines.push('Hard rules from the skill, restated because they are absolute:');
  lines.push('');
  lines.push('- Prime directive: never drop or modify a skill this repository does not own; collisions with foreign skills are reported and asked about, never overwritten.');
  lines.push('- Copies stay byte-identical to the repository source; never transform content during copy.');
  lines.push('- Orphaned managed copies are removed only when their file map still matches the manifest; a diverged copy is reported and asked about.');
  lines.push('');
  lines.push('## Step 2 — Install the configured plugins');
  lines.push('');
  if (resolved.plugins.length === 0) {
    lines.push(
      'No plugins are configured (`plugins: []`): state that explicitly and skip this step.',
    );
  } else {
    lines.push(
      'Install each configured plugin with the `plugin_manager` tool: action `install_bundle`, target exactly the configured string (an absolute local path or a git spec — in order):',
    );
    lines.push('');
    resolved.plugins.forEach((target, index) => {
      lines.push(`${index + 1}. \`${target}\``);
    });
    lines.push('');
    lines.push(
      'Approvals apply normally — never bypass or pre-approve them. For each installation, report the result\'s `application` and `warnings` fields verbatim; treat a failed or pending application as a failure to report honestly, and continue with the remaining entries unless the failure makes later installs meaningless.',
    );
  }
  lines.push('');
  lines.push('## Step 3 — Restart note');
  lines.push('');
  lines.push(
    'Report that a DSH restart is needed for newly linked module generations: a replaced package keeps serving its previous module generation until the Host restarts.',
  );
  lines.push('');
  lines.push('## Final report');
  lines.push('');
  lines.push(
    'End with a summary: the skills table from step 1, each plugin install outcome, the restart note, and — if the run stopped early — exactly where it stopped.',
  );
  lines.push('');
  return lines.join('\n');
}

/**
 * Build the immutable steered user message, matching dsh-llm's
 * `createUserMessage` shape.
 * @param {readonly object[]} content admitted content blocks.
 * @returns {object} frozen user message.
 */
function createSteeredMessage(content) {
  return deepFreeze({
    role: 'user',
    content: [...content],
    source: { kind: 'user' },
    id: randomUUID(),
  });
}

/**
 * Host plugin entry: register both commands against the optional
 * `commands` service; return the injected fiber's disposal as cleanup.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx plugin context.
 * @param {unknown} config raw row config (already validated via `Config`).
 * @returns {() => void} cleanup.
 */
export function apply(ctx, config) {
  const resolved = resolveConfig(config);
  const fiber = ctx.inject(['commands'], (commandCtx) => {
    const disposers = [];
    disposers.push(commandCtx.commands.register({
      name: 'backup',
      description: 'Back up DSH profiles into this repo, then commit (and optionally push)',
      input: { hint: '[note]' },
      // The steered procedure prompt carries any note verbatim; recording
      // the raw input too would duplicate it in the session log.
      recordInput: false,
      handler: ({ agent, rawInput = '' }) => {
        agent.steer(createSteeredMessage([
          { type: 'text', text: buildBackupPrompt(resolved, rawInput.trim()) },
        ]));
        return {
          kind: 'success',
          text: resolved.autoPush
            ? 'Backup run started — profiles first, then the git confirmations (commit, push when origin exists).'
            : 'Backup run started — profiles first, then the commit confirmation (auto-push disabled).',
        };
      },
    }));
    disposers.push(commandCtx.commands.register({
      name: 'restore',
      description: 'Sync this repo\'s skills and install the configured plugins',
      input: { hint: '[note]' },
      recordInput: false,
      handler: ({ agent, rawInput = '' }) => {
        agent.steer(createSteeredMessage([
          { type: 'text', text: buildRestorePrompt(resolved, rawInput.trim()) },
        ]));
        return {
          kind: 'success',
          text: resolved.plugins.length > 0
            ? `Restore run started — skills sync, then ${resolved.plugins.length} plugin install(s), then the restart note.`
            : 'Restore run started — skills sync (no plugins configured), then the restart note.',
        };
      },
    }));
    return () => {
      for (const dispose of disposers) dispose();
    };
  });
  return () => fiber.dispose();
}
