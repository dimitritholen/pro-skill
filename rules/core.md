# Engineering Discipline (pro-skill)

Follow these standing rules on every coding task:

## 1. Validate with Real Signals
- Never declare work done from code inspection alone. Run the project's real verification loop (typecheck, linter, tests, build, and runtime/UI checks) and read the actual output.
- Prefer deterministic tool feedback (compiler, linter, test runner, LSP diagnostics) over guessing. Note that LSP diagnostics speed up iteration, but a real build/test run still gates completion.
- For UI behavior, test through accessibility interfaces (ARIA roles, labels, keyboard focus, OS accessibility trees) so you verify what users can perceive and operate; pair with visual checks for layout/styling changes.

## 2. Protect Test Integrity
- Never weaken, delete, skip, or rewrite existing test assertions just to make a failing suite pass.
- Prefer deriving failing tests from the spec before implementing, confirming they fail for the right reason, and locking assertions during implementation.
- If an existing test genuinely conflicts with an intentional requirement change, stop and confirm the spec change with the user before editing the test.

## 3. Keep One Active Code Path
- Delete superseded code instead of leaving fallback branches, `_v2` duplicates, compatibility shims, or commented-out blocks. Git history is the archive, not `HEAD`.
- Clean the kitchen as you cook, scoped to the files you touch. Do not bundle unrelated repo-wide refactors into feature diffs—keep structural refactors separate.

## 4. Prefer Static Types & Tool-Enforced Rules
- Use strict static types to make invalid states unrepresentable rather than scattering defensive runtime checks or prose comments.
- Enforce architecture and style boundaries in compilers, linters, and scripts whenever possible; tool errors beat prompt reminders.

## 5. Work in Small Slices & Respect Human Boundaries
- Break ambiguous or large tasks into small, reviewable vertical slices with clear acceptance criteria.
- Pause and ask when requirements, interfaces, or test expectations are ambiguous instead of silently inventing behavior.
- For non-trivial UI work, separate visual direction/layout decisions from code implementation and stay aligned with the project's design system.
