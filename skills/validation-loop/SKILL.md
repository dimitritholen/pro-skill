---
name: validation-loop
description: Design and run tight, deterministic validation loops for code and UI changes—failing-first tests for non-trivial logic, locked assertions, accessibility-driven E2E verification and fast diagnostics, with verification scaled to risk. Use when implementing features, fixing bugs, setting up project verification, or checking whether work is truly done.
---

# Validation Loop

Turn coding from guesswork into a tight, deterministic feedback loop.

## 1. Establish the Repo Verification Command
Before editing, identify the fastest reliable feedback commands in the repository:
1. **Fast inner loop:** typecheck (`tsc --noEmit`, `cargo check`, `go vet`, or LSP diagnostics on large repos) + targeted unit/integration test.
2. **Baseline:** run relevant existing checks before implementation when practical. Record pre-existing failures and distinguish them from regressions.
3. **Completion gate, scaled to risk:** a small, reversible change needs its fast checks; CI runs the rest. Run the broad gates locally only for changes to shared behaviour, data, money or security, or when CI does not cover them. Do not invent a lint/build stage for projects without one.

## 2. Spec-First Tests with Locked Assertions
Avoid writing tests and implementation together from the same biased mental model. Use it for bug fixes and non-trivial logic; skip it for docs, prompts, config and trivial edits.
1. State the observable behavior and edge cases from the requirement/spec.
2. Write or update the failing test first, before editing the implementation.
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
- The checks that fit the risk ran after the final relevant edit, and their failures are classified as pre-existing or introduced.
- Any untested surface, unavailable environment, or unresolved failure is explicit. Report a limitation instead of claiming the affected behavior is verified.
- State what changed, which checks ran and their results, and any remaining acceptance steps. A green suite proves the tested behavior, not the correctness of the specification.

## 5. Protect the Verification System
- Review the diff for changes to test discovery, runner flags, fixtures, mocks, snapshots, compiler/linter configuration, and CI—not only assertion files.
- For stronger integrity, have a trusted CI job compare protected tests and verification configuration against an approved baseline. Keep the baseline and job policy outside the agent's write permissions where enforcement matters.
- Treat local hooks as convenience guardrails: agents with shell access or control over hook configuration can bypass them. Never claim tamper resistance from an agent-editable hook.
