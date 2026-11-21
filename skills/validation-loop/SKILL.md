---
name: validation-loop
description: Design and run tight, deterministic validation loops for code and UI changes—spec-first failing tests, locked assertions, accessibility-driven E2E verification, fast diagnostics, and full build gates. Use when implementing features, fixing bugs, setting up project verification, or checking whether work is truly done.
---

# Validation Loop

Turn coding from guesswork into a tight, deterministic feedback loop.

## 1. Establish the Repo Verification Command
Before editing, identify the fastest reliable feedback commands in the repository:
1. **Fast inner loop:** typecheck (`tsc --noEmit`, `cargo check`, `go vet`, or LSP diagnostics on large repos) + targeted unit/integration test.
2. **Baseline:** run relevant existing checks before implementation when practical. Record pre-existing failures and distinguish them from regressions.
3. **Completion gate:** the repository's applicable checks: typecheck, lint, tests, build, and runtime verification as available and relevant. Do not invent a mandatory lint/build stage for projects without one. Run broad gates for changes affecting shared behavior; scale trivial edits proportionally. LSP diagnostics never replace a build when codegen, bundlers, macros, or cross-package exports are involved.

If a repo lacks a single verification command, recommend adding one (e.g., `npm run verify`) so every change runs the same gate.

## 2. Spec-First Tests with Locked Assertions
Avoid writing tests and implementation together from the same biased mental model:
1. State the observable behavior and edge cases from the requirement/spec.
2. Write or update the failing test first.
3. Run it and confirm it fails **for the expected reason** (missing behavior or wrong result—not a syntax or setup error).
4. Once assertions are agreed upon, preserve their **behavioral guarantees** during implementation:
   - Do not loosen assertions, widen tolerances, mock away the unit under test, or add `.skip`.
   - Add regression cases and maintain test setup without weakening existing guarantees.
   - Change expectations only for an already-authorized requirement change; otherwise confirm the specification first. Do not repeatedly ask for authorization already given.
   - A file-edit hook cannot distinguish additions from weakened assertions. If enabled, its prompts are conservative file-level checks, not a verdict on test meaning.

## 3. Accessibility-First UI Verification
When testing web or desktop UI functionality:
- Query and drive elements via **accessibility interfaces** (ARIA roles, accessible names, labels, form controls, keyboard navigation, OS accessibility trees) rather than fragile CSS classes or DOM structure.
- Verify real user flows: focus order, keyboard submission, error announcements, disabled/loading states, and empty/edge-case data.
- Because accessibility trees do not catch visual defects (overlap, clipping, broken contrast, bad spacing), pair accessibility checks with a visual/screenshot check whenever layout or styling changes.

## 4. Exit Criteria
Report work as complete only when:
- Applicable gates have fresh output after the final relevant edit; any failures are classified as pre-existing or introduced, with evidence.
- Any untested surface, unavailable environment, or unresolved failure is explicit. Report a limitation instead of claiming the affected behavior is verified.
- State what changed, which checks ran and their results, and any remaining acceptance steps. A green suite proves the tested behavior, not the correctness of the specification.

## 5. Protect the Verification System
- Review the diff for changes to test discovery, runner flags, fixtures, mocks, snapshots, compiler/linter configuration, and CI—not only assertion files.
- For stronger integrity, have a trusted CI job compare protected tests and verification configuration against an approved baseline. Keep the baseline and job policy outside the agent's write permissions where enforcement matters.
- Treat local hooks as convenience guardrails: agents with shell access or control over hook configuration can bypass them. Never claim tamper resistance from an agent-editable hook.
