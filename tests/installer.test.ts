import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { install, listBundledSkills, status, uninstall } from "../src/installer.js";
import { ALL_TOOLS } from "../src/types.js";

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

describe("installer", () => {
  it("lists all 4 bundled skills", () => {
    const skills = listBundledSkills(PACKAGE_ROOT);
    assert.deepEqual(skills, [
      "clean-codepath",
      "type-driven-design",
      "ui-craft-loop",
      "validation-loop",
    ]);
  });

  it("dry-run plans changes without creating any files", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "pro-skill-dry-"));
    try {
      const res = install({
        scope: { kind: "global", homeDir: tmpHome },
        tools: ALL_TOOLS,
        withHooks: true,
        linkSkills: false,
        dryRun: true,
        packageRoot: PACKAGE_ROOT,
      });
      assert.equal(res.dryRun, true);
      assert.ok(res.changes.length > 0);
      assert.deepEqual(fs.readdirSync(tmpHome), []);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("installs globally across all 4 tools, stays idempotent, preserves user rules, and uninstalls cleanly", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "pro-skill-home-"));
    try {
      // Seed pre-existing user files to verify non-destructive install & uninstall
      const piRules = path.join(tmpHome, ".pi", "agent", "AGENTS.md");
      fs.mkdirSync(path.dirname(piRules), { recursive: true });
      fs.writeFileSync(piRules, "# Existing Pi Rules\nKeep me intact.\n");

      const claudeSettings = path.join(tmpHome, ".claude", "settings.json");
      fs.mkdirSync(path.dirname(claudeSettings), { recursive: true });
      fs.writeFileSync(
        claudeSettings,
        JSON.stringify({ permissions: { allow: ["Read"] } }, null, 2) + "\n",
      );

      // 1. Install with hooks
      const first = install({
        scope: { kind: "global", homeDir: tmpHome },
        tools: ALL_TOOLS,
        withHooks: true,
        linkSkills: false,
        dryRun: false,
        packageRoot: PACKAGE_ROOT,
      });
      assert.ok(first.changes.some((c) => c.action === "created"));

      // Verify existing Pi rules were preserved
      const piAfter = fs.readFileSync(piRules, "utf8");
      assert.ok(piAfter.startsWith("# Existing Pi Rules\nKeep me intact.\n"));
      assert.ok(piAfter.includes("<!-- pro-skill:start -->"));

      // 2. Status reports everything installed
      const reports = status({
        scope: { kind: "global", homeDir: tmpHome },
        tools: ALL_TOOLS,
        packageRoot: PACKAGE_ROOT,
      });
      for (const report of reports) {
        assert.equal(report.rulesInstalled, true, `${report.tool} rules`);
        assert.equal(report.missingSkills.length, 0, `${report.tool} skills`);
        if (report.hookSupported) {
          assert.equal(report.hookInstalled, true, `${report.tool} hook`);
        }
      }

      // 3. Re-install is completely idempotent
      const second = install({
        scope: { kind: "global", homeDir: tmpHome },
        tools: ALL_TOOLS,
        withHooks: true,
        linkSkills: false,
        dryRun: false,
        packageRoot: PACKAGE_ROOT,
      });
      assert.ok(
        second.changes.every((c) => c.action === "unchanged"),
        `Expected all unchanged, got: ${JSON.stringify(second.changes)}`,
      );

      // 4. Uninstall cleanly removes pro-skill while preserving pre-existing user files
      const removed = uninstall({
        scope: { kind: "global", homeDir: tmpHome },
        tools: ALL_TOOLS,
        dryRun: false,
        packageRoot: PACKAGE_ROOT,
      });
      assert.ok(removed.changes.some((c) => c.action === "removed"));

      assert.equal(
        fs.readFileSync(piRules, "utf8"),
        "# Existing Pi Rules\nKeep me intact.\n",
      );
      assert.deepEqual(JSON.parse(fs.readFileSync(claudeSettings, "utf8")), {
        permissions: { allow: ["Read"] },
      });
      // Files created purely for pro-skill should be removed cleanly
      assert.equal(
        fs.existsSync(path.join(tmpHome, ".codex", "AGENTS.md")),
        false,
      );
      assert.equal(
        fs.existsSync(path.join(tmpHome, ".gemini", "config", "hooks.json")),
        false,
      );
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("installs into a project directory without duplicating AGENTS.md writes", () => {
    const tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "pro-skill-proj-"));
    try {
      const res = install({
        scope: { kind: "project", projectDir: tmpProject },
        tools: ALL_TOOLS,
        withHooks: false,
        linkSkills: false,
        dryRun: false,
        packageRoot: PACKAGE_ROOT,
      });
      const rulesChanges = res.changes.filter((c) => c.kind === "rules");
      // One for CLAUDE.md, one deduplicated for AGENTS.md (shared by Pi, Antigravity, Codex)
      assert.equal(rulesChanges.length, 2);
      assert.equal(fs.existsSync(path.join(tmpProject, "AGENTS.md")), true);
      assert.equal(fs.existsSync(path.join(tmpProject, "CLAUDE.md")), true);
      assert.equal(
        fs.existsSync(
          path.join(tmpProject, ".agents", "skills", "validation-loop", "SKILL.md"),
        ),
        true,
      );
      assert.equal(
        fs.existsSync(
          path.join(tmpProject, ".claude", "skills", "validation-loop", "SKILL.md"),
        ),
        true,
      );
    } finally {
      fs.rmSync(tmpProject, { recursive: true, force: true });
    }
  });
});
