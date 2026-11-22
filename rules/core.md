# Engineering Discipline (pro-skill)

Follow these standing rules on every coding task:

## 1. Validate with Real Signals
- Before editing, identify the repository's verification commands and note any pre-existing failures.
- Use focused checks while iterating, then run the applicable repository gates (types, lint, tests, build, runtime/UI) and read their output before reporting success.
- Scale verification to risk and report exact checks, results, and any unverified surfaces; never present an unrun check as passing.
- Prefer deterministic tool feedback (compiler, linter, test runner, LSP diagnostics) over guessing; LSP speeds up iteration, but a real build/test run still gates completion.
- Reproduce ambiguous failures and investigate root cause before editing—don't mask broken invariants with extra null checks, retries, or sleeps.
- For UI behavior, test through accessibility interfaces (ARIA roles, labels, keyboard focus, OS accessibility trees) and pair with visual checks for layout/styling changes.

## 2. Protect Test Integrity
- Never weaken, delete, skip, or rewrite existing test assertions just to make a failing suite pass.
- For behavior changes and bug fixes, write the failing test from the spec first, run it, and confirm it fails for the right reason before implementing; preserve those guarantees during implementation. Skip only for docs, config, or trivial edits, and say so.
- Test observable behavior and edge cases rather than internal implementation details or mock call sequences.
- Report the red run (command and failing assertion) alongside the final green run.
- Adding regression tests and maintaining test setup is encouraged; change existing expectations only for an authorized requirement change (confirm with the user first if unsure).
- Treat changes to test discovery, mocks, fixtures, runner flags, and CI with the same scrutiny as assertion changes.

## 3. Keep One Active Code Path
- Delete obsolete paths and commented-out code—git history is the archive, not `HEAD`.
- Retain necessary rollout compatibility adapters, flags, or dual writes only with an explicit owner, removal condition, and test coverage.
- Prefer direct, readable code over speculative abstractions, single-use wrappers, or unused configurability.
- Clean what you touch; keep unrelated repo-wide refactors separate from feature diffs.

## 4. Static Types, Explicit Failures & Testable Design
- Model internal states with strict static types and parse external inputs at boundaries; keep runtime checks for authorization, persistence constraints, and invariants.
- Keep core logic pure and decoupled from I/O, network, clocks, and global state so behavior is testable without brittle mocks.
- Handle or propagate failures explicitly with context; never hide errors behind silent `catch` blocks or unrequested fallbacks.
- Enforce architecture and style boundaries in compilers, linters, and scripts whenever possible; tool errors beat prompt reminders.

## 5. Small Slices, Workspace Hygiene & Human Boundaries
- Break large or ambiguous work into small, reviewable vertical slices with observable acceptance criteria.
- Ask when ambiguity materially changes behavior, public interfaces, data safety, or acceptance criteria; for reversible implementation details, follow repository conventions and state key assumptions.
- For non-trivial UI work, separate visual direction from implementation and stay aligned with the project's design system.
- Preserve unrelated working-tree changes, reuse existing abstractions before adding dependencies, and never expose secrets in logs, commits, or fixtures.
