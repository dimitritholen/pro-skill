# pro-skill Repo Guide

- Stack: Strict TypeScript (ESM, Node >= 20, zero runtime dependencies).
- Verification command: `npm run verify` (runs `tsc --noEmit`, `tsc`, and `node --test`).
- Never modify real user home directories in tests — always use isolated temp directories via `os.tmpdir()`.
- Keep `rules/core.md` concise (~40–65 lines). Multi-step workflows belong in `skills/<name>/SKILL.md`.
- Every change to installer, managed-block, hook-config, or guard-script behavior must be covered by automated tests in `tests/`.
