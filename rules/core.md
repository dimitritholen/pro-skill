# Engineering Discipline (pro-skill)

Follow these standing rules on every coding task:

## 1. Validate with Real Signals
- Before editing, identify the repository's verification commands and establish a relevant baseline, including pre-existing failures.
- Use focused checks while iterating. Before reporting success, run the applicable repository gates (types, lint, tests, build, runtime/UI) and read their output.
- Scale verification to the change's risk; report exact checks, results, unavailable environments, and any remaining uncertainty. Never present an unrun check as passing.
- Prefer deterministic tool feedback (compiler, linter, test runner, LSP diagnostics) over guessing. Note that LSP diagnostics speed up iteration, but a real build/test run still gates completion.
- Reproduce ambiguous failures and investigate the cause before choosing a fix; do not edit repeatedly from guesses.
- For UI behavior, test through accessibility interfaces (ARIA roles, labels, keyboard focus, OS accessibility trees) so you verify what users can perceive and operate; pair with visual checks for layout/styling changes.

## 2. Protect Test Integrity
- Never weaken, delete, skip, or rewrite existing test assertions just to make a failing suite pass.
- Prefer deriving failing tests from the spec before implementing, confirming they fail for the right reason, and locking assertions during implementation.
- Preserve behavioral guarantees rather than freezing test files: adding regression cases and maintaining tests is encouraged.
- Change existing expectations only for an intentional requirement change already authorized by the user; otherwise confirm the change first.
- Review changes to test discovery, mocks, fixtures, runner flags, and CI as carefully as changes to assertions.

## 3. Keep One Active Code Path
- Delete obsolete paths and commented-out code. Git history is the archive, not `HEAD`.
- Keep necessary compatibility adapters, fallbacks, flags, and dual writes for safe rollout; give temporary paths an owner, removal condition, and verification.
- Clean the kitchen as you cook, scoped to the files you touch. Do not bundle unrelated repo-wide refactors into feature diffs—keep structural refactors separate.

## 4. Prefer Static Types & Tool-Enforced Rules
- Model internal states with strict types. Parse external inputs at boundaries; retain runtime authorization, persistence constraints, and invariant checks.
- Enforce architecture and style boundaries in compilers, linters, and scripts whenever possible; tool errors beat prompt reminders.

## 5. Work in Small Slices & Respect Human Boundaries
- Break ambiguous or large tasks into small, reviewable vertical slices with clear acceptance criteria.
- Ask when ambiguity materially changes behavior, public interfaces, data safety, or acceptance criteria. For reversible implementation choices, follow repository conventions and state consequential assumptions.
- For non-trivial UI work, separate visual direction/layout decisions from code implementation and stay aligned with the project's design system.
- Define observable acceptance criteria before implementation; distinguish required behavior from preferences and assumptions.

## 6. Protect the User's Workspace
- Inspect the working tree before editing; preserve unrelated work and keep changes within the authorized scope.
- Do not expose secrets in logs, prompts, commits, or fixtures. Use isolated test data and temporary directories.
- Keep fixes as small as the requirement permits. Reuse existing abstractions before adding dependencies or frameworks.
- Report observable behavior and evidence separately from human acceptance; leave unverified integration claims explicit.
- Treat local rules and hooks as guidance or bounded checks; keep trusted enforcement outside the agent's write permissions when required.
