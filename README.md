# pro-skill

Installable engineering discipline, focused Agent Skills, and an optional test-integrity guard hook for **Claude Code**, **Pi**, **Antigravity**, and **Codex**.

## Philosophy

Coding agents perform dramatically better inside tight, deterministic feedback loops than with giant prose prompts. `pro-skill` splits its guidance into three deliberate layers:

1. **Always-On Core Rules (`rules/core.md`)** — A lean standing discipline block (~35 lines) injected non-destructively between `<!-- pro-skill:start -->` and `<!-- pro-skill:end -->` markers so your existing personal or repo rules are never overwritten:
   - Validate with real signals (typecheck, linter, tests, build, accessibility interfaces).
   - Protect test integrity (never weaken, skip, or rewrite existing tests to force green CI).
   - Keep one valid active code path (git history is the archive, not `HEAD`).
   - Clean what you touch; separate big structural refactors from feature diffs.
   - Prefer static types and tool-enforced rules over defensive guesses and comments.
   - Work in small vertical slices and pause when specs or assertions are ambiguous.

2. **On-Demand Agent Skills (`skills/`)** — Open Agent Skills format (`SKILL.md`), loaded progressively only when relevant:
   - `validation-loop` — Spec-first failing tests, locked assertions, accessibility-first UI checks, fast diagnostics vs. full build gates.
   - `clean-codepath` — Replace in place, delete dead fallbacks/shims, scoped Boy-Scout cleanup, mechanical dead-code checks.
   - `type-driven-design` — Discriminated unions, parse-don't-validate, compiler-driven refactoring, tool-enforced architecture.
   - `ui-craft-loop` — Separate visual direction from code, design all UI states, verify via accessibility interfaces + visual checks.

3. **Optional Deterministic Guardrail (`scripts/guard-tests.mjs`, opt-in via `--with-hooks`)** — A zero-dependency `PreToolUse` hook for Claude Code and Antigravity that stops agents from silently modifying existing tests.

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
node dist/src/cli.js install --global --tools claude,pi,antigravity,codex

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
pro-skill uninstall --global
```

### Installing Skills Only via `npx skills`
Because skills follow the standard `skills/<name>/SKILL.md` layout, anyone can install just the skills once this repo is pushed to GitHub:
```bash
npx skills add <owner>/pro-skill -a claude-code -a codex -a pi -a antigravity
```

---

## CLI Reference

```text
pro-skill <install|uninstall|status> [options]
```

| Flag | Description |
| :--- | :--- |
| `--global` | Target global user configuration directories *(default)*. |
| `--project <dir>` | Target a specific repository/project directory. |
| `--tools <list>` | Comma-separated subset of `claude,pi,antigravity,codex` *(default: all)*. |
| `--with-hooks` | Also install and wire `guard-tests.mjs` for Claude Code and Antigravity. |
| `--link` | Symlink/junction skill directories directly from this repo instead of copying. |
| `--dry-run` | Print planned changes without modifying any files. |
| `-h, --help` | Print usage help. |

### Copy Mode vs. `--link` Mode

- **Copy (default):** Copies each skill folder into `~/.claude/skills/` and `~/.agents/skills/` (or project equivalents). Self-contained—keeps working even if you move or delete this repo clone. Re-run `pro-skill install` after editing skills to sync updates.
- **Link (`--link`):** Creates directory junctions on Windows (symlinks on macOS/Linux) pointing directly at `<repo>/skills/<name>`. Edits to any `SKILL.md` take effect immediately across all tools without reinstalling. *(Changes to `rules/core.md` or `scripts/guard-tests.mjs` still require re-running `pro-skill install`.)*

---

## Target Paths

| Tool | Global Rules | Global Skills | Global Hook (`--with-hooks`) |
| :--- | :--- | :--- | :--- |
| **Claude Code** | `~/.claude/CLAUDE.md` | `~/.claude/skills/` | `~/.claude/settings.json` |
| **Pi** | `~/.pi/agent/AGENTS.md` | `~/.agents/skills/` | — |
| **Antigravity** | `~/.gemini/config/AGENTS.md` | `~/.agents/skills/` | `~/.gemini/config/hooks.json` |
| **Codex** | `~/.codex/AGENTS.md` | `~/.agents/skills/` | — |

In `--project <dir>` mode:
- Rules: `<dir>/CLAUDE.md` (Claude Code) and `<dir>/AGENTS.md` (shared by Pi, Antigravity, Codex).
- Skills: `<dir>/.claude/skills/` and `<dir>/.agents/skills/`.
- Hooks: `<dir>/.claude/settings.json` and `<dir>/.agents/hooks.json`.

---

## Test-Integrity Guard Hook (`--with-hooks`)

When enabled, `guard-tests.mjs` is installed to `.agents/pro-skill/guard-tests.mjs` and wired as a `PreToolUse` file-edit hook in **Claude Code** (`settings.json`) and **Antigravity** (`hooks.json`). *(Pi and Codex do not expose a standardized `PreToolUse` hook config, so they rely on the standing rule + `validation-loop` skill.)*

### Behavior

- **Non-test files:** Always allowed.
- **Creating a brand-new test file:** Always allowed (agents should be free to add tests).
- **Editing an existing test file:**
  - **Default (`ask`):** Prompts you for confirmation (`permissionDecision: "ask"` in Claude Code, `decision: "force_ask"` in Antigravity) so you can verify it's an intentional spec change rather than assertion-weakening.
  - **Hard lock (`deny`):** Blocks the edit (`exit 2` in Claude Code, `decision: "deny"` in Antigravity) whenever:
    - An empty `.pro-skill-lock-tests` marker file exists in the repo root (or any parent directory up to `cwd`), **or**
    - Environment variable `PRO_SKILL_TEST_GUARD=deny` is set.
  - **Temporary bypass (`off`):** Set `PRO_SKILL_TEST_GUARD=off`.

### Matched Test File Patterns
A file is treated as a test file if its filename matches `*.test.*`, `*.spec.*`, `*.e2e.*`, `*_test.*`, `test_*.*`, or `*Test(s).{cs,java,kt,swift}`, or if it lives inside a `test/`, `tests/`, `__tests__/`, `spec/`, `specs/`, or `e2e/` directory.

---

## Updating & Uninstalling

- **Updating:** Edit `rules/core.md`, `skills/*`, or `scripts/guard-tests.mjs`, run `npm run verify`, and re-run `pro-skill install` with your preferred flags. Installs are idempotent: only the `<!-- pro-skill:start/end -->` block, bundled skills, and `pro-skill` hook entries are touched.
- **Uninstalling:** Run `pro-skill uninstall --global` (or `--project <dir>`). It cleanly strips the managed block, removes only `pro-skill`'s bundled skills and hook entries, and preserves all pre-existing user rules and settings. Files that were created *solely* for `pro-skill` are deleted when empty.

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
