---
name: clean-codepath
description: Keep repositories lean with a single active code path—delete superseded code instead of leaving fallbacks or shims, scope boy-scout cleanup to touched files, and separate structural refactors from feature work. Use when replacing implementations, migrating APIs, refactoring, or auditing dead code.
---

# Clean Codepath

Git history is your archive. Remove obsolete implementations while preserving paths required by live consumers, resilience, or a safe rollout.

## 1. One Valid Code Path
When replacing an implementation, schema, route, or helper:
- **Replace in place** rather than creating `fooV2`, `legacyFoo`, or dual-write fallback branches unless an explicit live-migration rollout requires a temporary bridge.
- Remove obsolete helpers, feature flags, dead config keys, unused types, and stale imports in the same change.
- Never leave commented-out "just in case" code blocks—commit history preserves prior versions cleanly.
- If a temporary compatibility shim is genuinely required (e.g., rolling deploy or external consumers), mark it with an explicit removal condition/owner and test the transition. Do not delete required compatibility merely to satisfy a single-path preference.

## 2. Scoped Kitchen Cleanup
"Clean as you cook" works only when bounded:
- **Do** tidy dead code, naming drift, and obvious duplication inside the files and call sites you are already modifying.
- **Do not** launch unsolicited repo-wide reformatting or unrelated architectural rewrites inside a bugfix or feature diff.
- When you spot larger structural debt outside your task scope, finish the current slice cleanly and propose the refactor as a dedicated follow-up step.

## 3. Mechanical Dead-Code Checks
Before finishing a replacement or refactor:
1. Search all references (via LSP find-references or repo search) to confirm zero callers remain for removed paths.
2. Run the project's unused-export / dead-code checker if available (e.g., `knip`, compiler unused-locals/params checks, linter rules).
3. Inspect `git diff --stat` to confirm the diff stays focused and leaves no orphaned files behind.
