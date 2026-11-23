# pro-skill

Installable engineering discipline, focused Agent Skills, and an optional test-integrity guard hook for **Claude Code**, **Antigravity**, and **Codex**.

## Philosophy

`pro-skill` aims to improve coding-agent behavior through concise guidance and deterministic feedback. Its effect on agent outcomes must be measured, rather than inferred from installation or passing installer tests. It splits guidance into three layers:

1. **Always-On Core Rules (`rules/core.md`)** — A lean standing discipline block (~40 lines) injected between `<!-- pro-skill:start -->` and `<!-- pro-skill:end -->` markers, preserving rules outside that managed block:
   - Validate with real signals (typecheck, linter, tests, build, accessibility interfaces).
   - Protect test integrity (never weaken, skip, or rewrite existing tests to force green CI).
   - Remove obsolete paths; retain necessary compatibility and rollout paths with explicit removal conditions.
   - Clean what you touch; separate big structural refactors from feature diffs.
   - Prefer static types and tool-enforced rules over defensive guesses and comments.
   - Work in small slices; ask about material ambiguity and use repository conventions for reversible choices.
   - Preserve unrelated work, protect secrets, and report verification limits.

2. **On-Demand Agent Skills (`skills/`)** — Open Agent Skills format (`SKILL.md`), loaded progressively only when relevant:
   - `validation-loop` — Spec-first tests, preserved behavioral guarantees, baseline checks, accessibility-first UI checks, and proportional verification gates.
   - `clean-codepath` — Replace in place, delete dead fallbacks/shims, scoped Boy-Scout cleanup, mechanical dead-code checks.
   - `type-driven-design` — Discriminated unions, parse-don't-validate, compiler-driven refactoring, tool-enforced architecture.
   - `ui-craft-loop` — Separate visual direction from code, design all UI states, verify via accessibility interfaces + visual checks.

3. **Optional File-Edit Guard (`scripts/guard-tests.mjs`, opt-in via `--with-hooks`)** — A zero-dependency `PreToolUse` hook that asks or denies when selected Claude Code and Antigravity edit tools target existing test files. It does not enforce assertion semantics or cover all filesystem writes.

---

## Quick Start

### 1. Build & Verify
```bash
npm install
npm run verify
```

### 2. Preview Changes (Dry Run)
```bash
node dist/src/cli.js install --global --with-hooks --dry-run
```

### 3. Install
```bash
# Global install across all 4 tools (rules + skills)
node dist/src/cli.js install --global

# Global install + optional test-guard hooks (Claude Code & Antigravity)
node dist/src/cli.js install --global --with-hooks

# Specific tools only
node dist/src/cli.js install --global --tools claude,antigravity,codex

# Into a single repository instead of global user config
node dist/src/cli.js install --project ./path/to/repo --with-hooks

# Link skills from this repo instead of copying (see Copy vs. Link below)
node dist/src/cli.js install --global --with-hooks --link
```

To make `pro-skill` available globally on your `PATH`:
```bash
npm link
pro-skill status --global
pro-skill install --global --with-hooks
pro-skill update --global
pro-skill uninstall --global
```

To pull the checked-out branch (normally `main`), reinstall dependencies, rebuild, and update your global install in one step, run from this repo:
```bash
npm run self-upgrade
```
It updates the global install only; for a project install, run `pro-skill update --project <dir>` afterwards. Use `npm run self-upgrade`, not `npm upgrade`: the latter is npm's alias for `npm update`.

### Installing Skills Only via `npx skills`
Because skills follow the standard `skills/<name>/SKILL.md` layout, anyone can install just the skills once this repo is pushed to GitHub:
```bash
npx skills add <owner>/pro-skill -a claude-code -a codex -a antigravity
```

---

## CLI Reference

```text
pro-skill <install|update|uninstall|status> [options]
```

| Flag | Description |
| :--- | :--- |
| `--global` | Target global user configuration directories *(default)*. |
| `--project <dir>` | Target a specific repository/project directory. |
| `--tools <list>` | Comma-separated subset of `claude,antigravity,codex` *(default: all)*. |
| `--with-hooks` | Also install and wire `guard-tests.mjs` for Claude Code and Antigravity. |
| `--link` | Symlink/junction skill directories directly from this repo instead of copying. |
| `--adopt` | Adopt/overwrite existing unmanaged or modified skills and guard scripts into `install-state.json`. |
| `--dry-run` | Print planned changes without modifying any files. |
| `-h, --help` | Print usage help. |

`update` takes only `--global`/`--project <dir>` and `--dry-run`. It reinstalls every recorded tool with the hook and copy/link choices that tool was installed with. To change those choices, run `install` with the new options.

### Copy Mode vs. `--link` Mode

- **Copy (default):** Copies each skill folder into the tool's skills directory (see Target Paths). Self-contained—keeps working even if you move or delete this repo clone. Run `pro-skill update` after editing bundled skills to sync updates. Locally modified installed copies are preserved rather than overwritten.
- **Link (`--link`):** Creates directory junctions on Windows (symlinks on macOS/Linux) pointing directly at `<repo>/skills/<name>`. Edits to any `SKILL.md` take effect immediately across all tools without reinstalling. *(Changes to `rules/core.md` or `scripts/guard-tests.mjs` still require re-running `pro-skill update`.)*

---

## Target Paths

| Tool | Global Rules | Global Skills | Global Hook (`--with-hooks`) |
| :--- | :--- | :--- | :--- |
| **Claude Code** | `~/.claude/CLAUDE.md` | `~/.claude/skills/` | `~/.claude/settings.json` |
| **Antigravity** | `~/.gemini/config/AGENTS.md` | `~/.gemini/config/skills/` | `~/.gemini/config/hooks.json` |
| **Codex** | `~/.codex/AGENTS.md` | `~/.agents/skills/` | — |

In `--project <dir>` mode:
- Rules: `<dir>/CLAUDE.md` (Claude Code) and `<dir>/AGENTS.md` (shared by Antigravity and Codex).
- Skills: `<dir>/.claude/skills/` and `<dir>/.agents/skills/`.
- Hooks: `<dir>/.claude/settings.json` and `<dir>/.agents/hooks.json`.

---

## Test-Integrity Guard Hook (`--with-hooks`)

When enabled, `guard-tests.mjs` is installed to `.agents/pro-skill/guard-tests.mjs` and wired as a `PreToolUse` file-edit hook in **Claude Code** (`settings.json`) and **Antigravity** (`hooks.json`). *(Codex does not expose a standardized `PreToolUse` hook config, so it relies on the standing rule + `validation-loop` skill.)*

### Behavior

- **Recognized non-test file paths:** Allowed.
- **Creating a brand-new test file:** Always allowed (agents should be free to add tests).
- **Editing an existing test file:**
  - **Default (`ask`):** Prompts you for confirmation (`permissionDecision: "ask"` in Claude Code, `decision: "force_ask"` in Antigravity). This includes harmless additions to existing test files: the guard sees the target path, not whether the edit preserves assertions.
  - **Hard lock (`deny`):** Blocks the edit (`exit 2` in Claude Code, `decision: "deny"` in Antigravity) whenever:
    - A `.pro-skill-lock-tests` marker exists along the file or working-directory ancestry through the nearest repository root (`.git` file or directory); outside a repository, ancestry is checked through the filesystem root, **or**
    - Environment variable `PRO_SKILL_TEST_GUARD=deny` is set.
  - **Temporary bypass (`off`):** Set `PRO_SKILL_TEST_GUARD=off`.
- **Malformed/unrecognized payload:** Asks by default and denies in locked/`deny` mode. Invalid guard modes deny rather than silently disabling the check.

### Enforcement limits

The guard matches Claude's `Edit|Write|MultiEdit` and Antigravity's `edit_file|write_file|write_to_file|replace_file_content|multi_replace_file_content`. Shell commands, other tools, test discovery/configuration changes, and edits to hooks or lock markers can bypass it. The agent can also change environment variables if its permissions allow that. A new test file can disable or alter a suite without modifying an existing test file.

For stronger test integrity, run comparison checks in trusted CI against an approved baseline of tests and verification configuration. Protect the baseline and CI policy from the agent's write permissions. A local hook is a convenience guardrail, not a tamper-resistant boundary.

`status` checks local file/configuration presence, including whether the guard script exists and the Antigravity entry is enabled. It does not prove an agent loaded the files, that hook matchers cover every action, or that an agent honored a skill. See [evaluation and integration checks](evaluations/README.md).

### Trade-off with test-first work

The core rules ask for a failing test before each behavior change, and adding a case to an existing test file is the usual way to write one. The guard can't tell an added case from a weakened assertion, so this trade-off is deliberate: in `ask` mode, approve edits that only add cases; with a lock in place, put new cases in a new test file. Neither the guard nor the rules can prove a red run happened. The required report of the red run is a check you can read, not enforcement.

### Matched Test File Patterns
A file is treated as a test file if its filename matches `*.test.*`, `*.spec.*`, `*.e2e.*`, `*_test.*`, `test_*.*`, or `*Test(s).{cs,java,kt,swift}`, or if it lives inside a `test/`, `tests/`, `__tests__/`, `spec/`, `specs/`, or `e2e/` directory.

---

## Updating & Uninstalling

- **Ownership:** Each scope records installed tools, resource owners, and content hashes in `.agents/pro-skill/install-state.json`. Keep this file with the installation. Unmanaged skill/script collisions are refused before writes, including in dry-run mode. Rules outside the managed block and unrelated hook handlers are preserved.
- **Updating:** Pull or edit bundled content, run `npm run verify`, then `pro-skill update --global` (or `--project <dir>`). It reapplies each tool's recorded hook and link choices and preflights every tool before writing. Updates refuse locally modified copied skills or guard scripts. Save or move those changes aside before reinstalling. Linked skills track the link destination, allowing their source content to change normally.
- **Uninstalling:** Run `uninstall --global` (or `--project <dir>`). Only recorded installations are removed. Shared resources and project rules remain while another installed tool needs them. Modified skill/script content is reported as `preserved` and becomes unmanaged. A later install will refuse that collision until you move it aside.
- **Older installations:** Installations without an ownership record are refused by default so unmanaged skills aren't silently overwritten. Pass `--adopt` (e.g., `pro-skill install --global --with-hooks --adopt`) to migrate an existing `pro-skill` install into `install-state.json`, or back up and move conflicting directories aside first. When migrating Antigravity, its old global copies in `~/.agents/skills/` remain untouched because other agents may use them. Managed rule blocks and exact pro-skill hook commands are updated in place.
- **Failure recovery:** Collision/config preflight happens before writes; filesystem operations are not a transaction. Do not run concurrent installs/uninstalls in one scope. If an I/O failure interrupts installation, preserve the ownership record and inspect partial changes before retrying.

Target paths and Antigravity tool names follow the [Antigravity discovery](https://antigravity.google/docs/customization-discovery) and [hook](https://antigravity.google/docs/hooks) contracts. Claude hook decisions follow its [hook reference](https://code.claude.com/docs/en/hooks). These contracts require periodic live checks against specific agent versions.

---

## Repository Layout & Development

```text
pro-skill/
├── rules/core.md            # Canonical always-on engineering discipline
├── skills/                  # Bundled Open Agent Skills (SKILL.md)
│   ├── clean-codepath/
│   ├── type-driven-design/
│   ├── ui-craft-loop/
│   └── validation-loop/
├── scripts/guard-tests.mjs  # Zero-dependency PreToolUse test guard
├── src/                     # Strictly typed CLI installer (Node ESM, zero runtime deps)
└── tests/                   # Automated test suite (isolated temp directories)
```

Run the full verification loop after any change:
```bash
npm run verify
```
