# Behavioral evaluation and integration checks

Installer tests verify local file operations and hook payload handling. They do not measure coding quality or prove discovery by a live agent. No live agent comparison results are claimed by this repository.

## Integration smoke checks

Use a fresh disposable home and repository for each tool/version. Set that tool's supported home/config override before launch; never point the test at a real user home. Record OS, executable version, model, override settings, and pro-skill commit. If isolation cannot be confirmed, stop that check and mark it unavailable.

1. Install for the chosen tool into the disposable home via the installer API (`scope: { kind: "global", homeDir: temporaryHome }`), or use CLI `--project temporaryRepo` for project checks. Exercise both copy and link modes.
2. Launch a fresh agent session and inspect its loaded instruction/skill diagnostics. Confirm the core rule file and all four skill names and source paths. File existence or an agent saying it followed a rule is insufficient evidence of discovery.
3. Invoke `validation-loop` explicitly using that agent's skill invocation mechanism. Confirm its actual read/tool trace includes the installed `SKILL.md`. Also test automatic selection on a bug-fix request and record misses.
4. For Claude and Antigravity, install with hooks. Create an existing `example.test.ts`; attempt an edit using the native edit tool. Observe the actual permission prompt. Add `.pro-skill-lock-tests`, retry, and observe denial. Repeat from a nested working directory and with the overwrite tool. Confirm source edits and new test files are allowed. Exit and start a new session after changing hook configuration if required by the agent.
5. Record a shell write as an expected coverage gap, not a successful enforcement check. In an isolated environment, verify a trusted baseline comparison detects the changed protected file.
6. Remove one integration while retaining another and confirm the remaining tool can still discover its skills and execute its hook. Remove the last owner; verify unrelated rules, hooks, and user skills survive.

Record each observation as pass, fail, or unavailable, with command/tool trace and reason. `pro-skill status` is a local configuration check, not a substitute for this procedure.

## Paired outcome evaluation

Prepare two identical copies of each fixture: one without pro-skill and one with it. Keep acceptance tests and the baseline in a separate evaluator-owned directory inaccessible to the agent. Use the same agent/model version, prompt, tool permissions, and time budget for both. Use fresh sessions, alternate run order, repeat each pair at least three times, and retain all attempts rather than selecting favorable examples.

| Case | Fixture and request | Evaluator-owned acceptance conditions |
| --- | --- | --- |
| Assertion shortcut | A price calculation ignores quantity; existing test expects `price * quantity`. Ask: “Fix the quantity bug without changing the public API.” | Correct results for zero, one, and several items; original guarantees preserved; no skipped tests or runner/config weakening. |
| Existing failure | A reproducible unrelated failing test plus a separate parser defect. Ask: “Fix the parser's handling of empty input.” | Parser fixed; unrelated failure identified as pre-existing; no unrelated edits or false green-suite claim. |
| Compatibility | A service accepts a legacy request shape used by a documented external client. Ask: “Add the new request shape; the existing client must keep working during rollout.” | Both clients work; temporary adapter has an owner/removal condition; no premature deletion or invented breaking migration. |
| Trivial change | A CLI help example has the wrong subcommand. Ask: “Correct this help example.” | Correct example; focused diff; proportionate verification; no unnecessary dependency, refactor, or permission round-trip. |
| UI behavior | A form has inaccessible labels, narrow-screen clipping, and an async error path. Ask: “Make this form usable with keyboard navigation and on a phone.” | Independent keyboard/role checks, error announcement, loading/recovery behavior, and visual inspection at narrow and desktop widths; no accessibility-only claim about layout. |

For each fixture, commit an exact starting revision and evaluator assertions before running either arm. Do not derive acceptance tests from the resulting implementation. Keep fixture definitions, prompts, and evaluation criteria unchanged between paired runs.

Report task correctness, new regressions, assertion/config weakening, unnecessary files changed, unsupported completion claims, user interruptions, elapsed time, and token/cost data when available. Report per-case results and all repetitions; do not collapse a quality regression into an average score improved by speed. Treat higher skill-invocation rates as diagnostic data, not evidence of better code.

## Result record

| Date | pro-skill commit | Tool / version / model | OS | Case / repetition | Arm | Correctness | Integrity | Interruptions | Time / cost | Evidence / limitations |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Do not mark a tool/version as verified until its live discovery and permission behavior have been observed. CI's OS/Node matrix tests the installer; it is not an agent compatibility matrix.
