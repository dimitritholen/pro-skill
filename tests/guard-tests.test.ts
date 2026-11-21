import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const GUARD_SCRIPT = path.join(REPO_ROOT, "scripts", "guard-tests.mjs");

function runGuard(
  harness: "claude" | "antigravity",
  payload: unknown,
  envOverrides: Record<string, string> = {},
) {
  return spawnSync(process.execPath, [GUARD_SCRIPT, "--harness", harness], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, ...envOverrides },
  });
}

describe("guard-tests.mjs", () => {
  it("allows editing non-test files and creating brand-new test files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pro-skill-guard-"));
    try {
      const srcFile = path.join(tmp, "src", "app.ts");
      fs.mkdirSync(path.dirname(srcFile), { recursive: true });
      fs.writeFileSync(srcFile, "export const x = 1;\n");

      const nonTest = runGuard("claude", {
        cwd: tmp,
        tool_input: { file_path: srcFile },
      });
      assert.equal(nonTest.status, 0);
      assert.equal(nonTest.stdout.trim(), "");

      const newTestFile = path.join(tmp, "tests", "brand-new.test.ts");
      const newTest = runGuard("antigravity", {
        cwd: tmp,
        toolCall: { name: "write_file", args: { Path: newTestFile } },
      });
      assert.equal(newTest.status, 0);
      const parsed = JSON.parse(newTest.stdout) as { decision: string };
      assert.equal(parsed.decision, "allow");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("prompts for confirmation when editing an existing test file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pro-skill-guard-"));
    try {
      const existingTest = path.join(tmp, "tests", "auth.test.ts");
      fs.mkdirSync(path.dirname(existingTest), { recursive: true });
      fs.writeFileSync(existingTest, "test('works', () => {});\n");

      const claudeRes = runGuard("claude", {
        cwd: tmp,
        tool_input: { file_path: existingTest },
      });
      assert.equal(claudeRes.status, 0);
      const claudeOut = JSON.parse(claudeRes.stdout) as {
        hookSpecificOutput: { permissionDecision: string };
      };
      assert.equal(claudeOut.hookSpecificOutput.permissionDecision, "ask");

      const agyRes = runGuard("antigravity", {
        cwd: tmp,
        toolCall: { name: "edit_file", args: { Path: existingTest } },
      });
      assert.equal(agyRes.status, 0);
      const agyOut = JSON.parse(agyRes.stdout) as { decision: string };
      assert.equal(agyOut.decision, "force_ask");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("hard-blocks editing existing tests when .pro-skill-lock-tests exists", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pro-skill-guard-"));
    try {
      fs.writeFileSync(path.join(tmp, ".pro-skill-lock-tests"), "");
      const existingTest = path.join(tmp, "src", "math.spec.ts");
      fs.mkdirSync(path.dirname(existingTest), { recursive: true });
      fs.writeFileSync(existingTest, "expect(1).toBe(1);\n");

      const claudeRes = runGuard("claude", {
        cwd: tmp,
        tool_input: { file_path: existingTest },
      });
      assert.equal(claudeRes.status, 2);
      assert.match(claudeRes.stderr, /pro-skill test guard blocked/);

      const agyRes = runGuard("antigravity", {
        cwd: tmp,
        toolCall: { name: "edit_file", args: { Path: existingTest } },
      });
      assert.equal(agyRes.status, 0);
      const agyOut = JSON.parse(agyRes.stdout) as { decision: string };
      assert.equal(agyOut.decision, "deny");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
