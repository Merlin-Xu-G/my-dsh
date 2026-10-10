# DSH Plugin Development — Reference Index

Extracted from the DeepSeek Harness desktop app (`app.asar`, version installed at
`C:\Users\MerlinXu\AppData\Local\Programs\DeepSeek Harness\resources\app.asar`).
DSH is built on the **Cordis** plugin framework; a DSH "plugin" is a Cordis plugin
packaged as an npm-style bundle.

## Start here

| Read | Why |
|---|---|
| [skills/cordis-plugin-development/SKILL.md](skills/cordis-plugin-development/SKILL.md) | **The main guide.** Workflow, knowledge sources, install/verify rules for any plugin, bundle, tool, or MCP connection. |
| [skills/cordis-plugin-development/references/host-plugin.md](skills/cordis-plugin-development/references/host-plugin.md) | Bundle manifest (`package.json` + `dsh.bundle.patch`), loader patch rows, display metadata/icon, Host plugin export forms (`apply(ctx, config)`, `inject`, `Config`), install/enable semantics. |
| [skills/cordis-plugin-development/references/ui-plugin.md](skills/cordis-plugin-development/references/ui-plugin.md) | Client (Web UI) plugin halves: `dsh.client` manifest section, `window.__ModuleLoader__.load`, slot registration, React from the module table. |
| [skills/cordis-plugin-development/templates/decoration/](skills/cordis-plugin-development/templates/decoration/) | Minimal working UI plugin: `package.json`, `cordis.patch.yml`, `index.js` (Host half), `client.js` (Client half). Copy these four files to start. |
| [skills/cordis-plugin-development/templates/mcp/](skills/cordis-plugin-development/templates/mcp/) | Minimal configuration-only MCP bundle (two files). |
| [skills/cordis-composition-reference/SKILL.md](skills/cordis-composition-reference/SKILL.md) | The loader YAML patch dialect: `insert`, override-by-id, `group`, `disabled`, `isolate`, `!!js` expressions. |
| [skills/cordis-composition-reference/references/packages.md](skills/cordis-composition-reference/references/packages.md) | Catalog of every shipped Cordis plugin package and whether its row takes `config`. Grep it, don't read it whole. |

## Deeper topics

| Read | Covers |
|---|---|
| [skills/cordis-plugin-development/references/practices.md](skills/cordis-plugin-development/references/practices.md) | Choosing extension points, contexts, state mechanisms; tool policy, agent context, session-derived state, Chat rows. |
| [skills/cordis-plugin-development/references/user-actions.md](skills/cordis-plugin-development/references/user-actions.md) | Sharing application operations between UI actions and agent tools. |
| [skills/cordis-plugin-development/references/verification.md](skills/cordis-plugin-development/references/verification.md) | Verification limits when no browser control is available. |
| [skills/cordis-plugin-development/references/mcp-bundle.md](skills/cordis-plugin-development/references/mcp-bundle.md) | Connecting an MCP server through a configuration-only bundle. |
| [skills/editing-cordis-compositions/SKILL.md](skills/editing-cordis-compositions/SKILL.md) | Authoring agent presets (declarations carried by bundle patches). |
| [skills/agent-experience/SKILL.md](skills/agent-experience/SKILL.md) | Guidelines for model-facing tool definitions, skills, and context design. |

## Real-world examples

| Read | What it shows |
|---|---|
| [examples/dsh-plugin-manager/README.md](examples/dsh-plugin-manager/README.md) (+ [.zh](examples/dsh-plugin-manager/README.zh.md)) | How bundles are installed/selected/enabled; the `plugin_manager` tool; registry fallback; HMR vs restart semantics. |
| [examples/dsh-web-app/cordis.patch.yml](examples/dsh-web-app/cordis.patch.yml) | A large, real `cordis.patch.yml` (21 KB) composing the whole web app. |
| [examples/dsh-web-app/presets/standard.patch.yml](examples/dsh-web-app/presets/standard.patch.yml), [minimal.patch.yml](examples/dsh-web-app/presets/minimal.patch.yml) | The shipped agent-preset compositions (`standard`, `minimal`, …). |
| [examples/dsh-web-app/package.json](examples/dsh-web-app/package.json) | Manifest of a full bundle. |
| [examples/dsh-agent-instructions/README.md](examples/dsh-agent-instructions/README.md) (+ [.zh](examples/dsh-agent-instructions/README.zh.md)) | How DSH loads **AGENTS.md / CLAUDE.md** chains into agent context (config: `maxBytes`, root discovery, overlays). |
| [examples/dsh-client-ui-plugin-manager/README.md](examples/dsh-client-ui-plugin-manager/README.md) | The **Plugins** sidebar page: Official/Installed sections, Add-plugin specs (npm/git/tarball/path), registry picker + China-mirror probing, per-plugin config-page slots. |
| [examples/dsh-plugin-package-inventory-deepseek/README.md](examples/dsh-plugin-package-inventory-deepseek/README.md) | Sends the active plugin package list as `dsh_plugin_packages` request metadata to the official API (not a store). |

## Framework docs (Cordis)

- [framework/cordis-README.md](framework/cordis-README.md)
- [framework/cordis-plugin-loader-README.md](framework/cordis-plugin-loader-README.md)
- [framework/cordis-plugin-group-README.md](framework/cordis-plugin-group-README.md)
- [framework/cordis-plugin-include-README.md](framework/cordis-plugin-include-README.md)
- [framework/cordis-plugin-timer-README.md](framework/cordis-plugin-timer-README.md)

## Quick start (from the official skill)

1. Copy `skills/cordis-plugin-development/templates/decoration/` (4 files) into a
   workspace directory; rename ids/package name.
2. A bundle = `package.json` with `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`;
   the patch inserts plugin rows (`id`, `name` = package specifier, `config`).
3. Host half: `index.js` exports `apply(ctx, config)` (+ optional `inject`, `Config`);
   register resources with `ctx.effect` / `ctx.on` and return cleanup.
4. UI half: `client.js` calls `window.__ModuleLoader__.load({ id, factory(require) { … } })`
   and registers into a slot via `ctx.slots.inject` / `ctx.slots.register`.
5. Install with the `plugin_manager` tool, `action: install_bundle`, `target` = absolute
   package directory. Read the result's `application` / `warnings` fields; confirm rows
   with `cordis_inspect_query` (no approval needed).

## Live inspection (inside a DSH agent session)

- `cordis_inspect_list` → providers; then `cordis_inspect_query` for:
  - `Service.listService` / `Event.listEvents` — exact Host/Client coding contracts
  - `Config.listConfigs` — live plugin Config JSON Schemas (+ `packageDir` per entry)
  - `Slots.listSubTree` (client) — live Web UI slot tree and registration props
  - `Theme.listTokens` (client) — theme token names for styling
  - `Tool.listTools` — tools visible to the agent

## Where more material lives

- Full file list of the app archive: `../../../.tmp/asar-all.txt` (12,967 paths).
  Extract any file with: `node ../../../.tmp/asar.js extract <app.asar> /dsh/node_modules/@deepseek-ai/<pkg>/<file> <out>`
- Skill-format examples (SKILL.md): `C:\Users\MerlinXu\AppData\Local\Programs\DeepSeek Harness\resources\runtime\office-skills\{office-docx,office-pptx,office-xlsx}\SKILL.md`
- Your workspace's `project.yaml` (`dsh-version: 0.2.1-alpha.1`) marks this directory as a DSH plugin project targeting that version.
