---
name: validation-loop
description: Design and run tight, deterministic validation loops for code and UI changes—spec-first failing tests, locked assertions, accessibility-driven E2E verification, fast diagnostics, and full build gates. Use when implementing features, fixing bugs, setting up project verification, or checking whether work is truly done.
---

# Validation Loop

Turn coding from guesswork into a tight, deterministic feedback loop.

## 1. Establish the Repo Verification Command
Before editing, identify the fastest reliable feedback commands in the repository:
1. **Fast inner loop:** typecheck (`tsc --noEmit`, `cargo check`, `go vet`, or LSP diagnostics on large repos) + targeted unit/integration test.
2. **Completion gate:** full project verification (typecheck + lint + test suite + production build). LSP diagnostics are great for speed, but never replace a full build when codegen, bundlers, macros, or cross-package exports are involved.

If a repo lacks a single verification command, recommend adding one (e.g., `npm run verify`) so every change runs the same gate.

## 2. Spec-First Tests with Locked Assertions
Avoid writing tests and implementation together from the same biased mental model:
1. State the observable behavior and edge cases from the requirement/spec.
2. Write or update the failing test first.
3. Run it and confirm it fails **for the expected reason** (missing behavior or wrong result—not a syntax or setup error).
4. Once assertions are agreed upon, treat existing tests as **locked** during implementation:
   - Do not loosen assertions, widen tolerances, mock away the unit under test, or add `.skip`.
   - If implementation reveals the spec itself was wrong, pause and ask the user before modifying test expectations.

## 3. Accessibility-First UI Verification
When testing web or desktop UI functionality:
- Query and drive elements via **accessibility interfaces** (ARIA roles, accessible names, labels, form controls, keyboard navigation, OS accessibility trees) rather than fragile CSS classes or DOM structure.
- Verify real user flows: focus order, keyboard submission, error announcements, disabled/loading states, and empty/edge-case data.
- Because accessibility trees do not catch visual defects (overlap, clipping, broken contrast, bad spacing), pair accessibility checks with a visual/screenshot check whenever layout or styling changes.

## 4. Exit Criteria
Report work as complete only when:
- Every layer of the verification gate passes with fresh output after the final edit.
- Any untested surface or environment limitation is stated explicitly.
