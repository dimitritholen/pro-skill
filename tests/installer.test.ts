import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { install, listBundledSkills, status, uninstall } from "../src/installer.js";
import { ALL_TOOLS, type InstallOptions } from "../src/types.js";

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const CLI_ENTRY = path.join(PACKAGE_ROOT, "dist", "src", "cli.js");

function withTempRoot(
  prefix: string,
  run: (options: InstallOptions, root: string) => void,
): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    run(
      {
        scope: { kind: "global", homeDir: root },
        tools: ["codex"],
        packageRoot: PACKAGE_ROOT,
        dryRun: false,
        withHooks: false,
        linkSkills: false,
      },
      root,
    );
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

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
    withTempRoot("pro-skill-dry-", (options, tmpHome) => {
      const res = install({
        ...options,
        tools: ALL_TOOLS,
        withHooks: true,
        dryRun: true,
      });
      assert.equal(res.dryRun, true);
      assert.ok(res.changes.length > 0);
      assert.deepEqual(fs.readdirSync(tmpHome), []);
    });
  });

  it("installs globally across all 4 tools, stays idempotent, preserves user rules, and uninstalls cleanly", () => {
    withTempRoot("pro-skill-home-", (options, tmpHome) => {
      const piRules = path.join(tmpHome, ".pi", "agent", "AGENTS.md");
      fs.mkdirSync(path.dirname(piRules), { recursive: true });
      fs.writeFileSync(piRules, "# Existing Pi Rules\nKeep me intact.\n");

      const claudeSettings = path.join(tmpHome, ".claude", "settings.json");
      fs.mkdirSync(path.dirname(claudeSettings), { recursive: true });
      fs.writeFileSync(
        claudeSettings,
        JSON.stringify({ permissions: { allow: ["Read"] } }, null, 2) + "\n",
      );

      const first = install({
        ...options,
        tools: ALL_TOOLS,
        withHooks: true,
      });
      assert.ok(first.changes.some((c) => c.action === "created"));

      const piAfter = fs.readFileSync(piRules, "utf8");
      assert.ok(piAfter.startsWith("# Existing Pi Rules\nKeep me intact.\n"));
      assert.ok(piAfter.includes("<!-- pro-skill:start -->"));

      const reports = status({
        scope: options.scope,
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

      const second = install({
        ...options,
        tools: ALL_TOOLS,
        withHooks: true,
      });
      assert.ok(
        second.changes.every((c) => c.action === "unchanged"),
        `Expected all unchanged, got: ${JSON.stringify(second.changes)}`,
      );

      const removed = uninstall({
        scope: options.scope,
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
      assert.equal(
        fs.existsSync(path.join(tmpHome, ".codex", "AGENTS.md")),
        false,
      );
      assert.equal(
        fs.existsSync(path.join(tmpHome, ".gemini", "config", "hooks.json")),
        false,
      );
      // Empty .agents/pro-skill dir is cleaned up when last owner uninstalls
      assert.equal(
        fs.existsSync(path.join(tmpHome, ".agents", "pro-skill")),
        false,
      );
    });
  });

  it("installs into a project directory without duplicating AGENTS.md writes", () => {
    withTempRoot("pro-skill-proj-", (options, tmpProject) => {
      const res = install({
        ...options,
        scope: { kind: "project", projectDir: tmpProject },
        tools: ALL_TOOLS,
      });
      const rulesChanges = res.changes.filter((c) => c.kind === "rules");
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
    });
  });

  it("refuses unmanaged skill collisions before changing rules, including dry-run", () => {
    withTempRoot("pro-skill-collision-", (options, root) => {
      const skill = path.join(root, ".agents", "skills", "validation-loop", "SKILL.md");
      fs.mkdirSync(path.dirname(skill), { recursive: true });
      fs.writeFileSync(skill, "user skill");
      for (const dryRun of [true, false]) {
        assert.throws(() => install({ ...options, dryRun }), /unmanaged/i);
        assert.equal(fs.readFileSync(skill, "utf8"), "user skill");
        assert.equal(fs.existsSync(path.join(root, ".codex", "AGENTS.md")), false);
      }
      uninstall(options);
      assert.equal(fs.readFileSync(skill, "utf8"), "user skill");
    });
  });

  it("adopts legacy unmanaged installations when --adopt is enabled", () => {
    withTempRoot("pro-skill-adopt-", (options, root) => {
      const skill = path.join(root, ".agents", "skills", "validation-loop", "SKILL.md");
      fs.mkdirSync(path.dirname(skill), { recursive: true });
      fs.writeFileSync(skill, "legacy v1 skill");

      assert.throws(() => install(options), /unmanaged/i);

      install({ ...options, adopt: true });
      assert.notEqual(fs.readFileSync(skill, "utf8"), "legacy v1 skill");
      assert.equal(
        fs.existsSync(path.join(root, ".agents", "pro-skill", "install-state.json")),
        true,
      );

      // Subsequent normal install without --adopt succeeds cleanly
      const second = install(options);
      assert.ok(second.changes.every((c) => c.action === "unchanged"));
    });
  });

  it("preserves modified installed skills on update and uninstall", () => {
    withTempRoot("pro-skill-modified-", (options, root) => {
      install(options);
      const skill = path.join(root, ".agents", "skills", "validation-loop", "SKILL.md");
      fs.appendFileSync(skill, "\nlocal addition");
      assert.throws(() => install(options), /modified/i);
      const result = uninstall(options);
      assert.ok(
        result.changes.some(
          (change) =>
            change.path === path.dirname(skill) && change.action === "preserved",
        ),
      );
      assert.match(fs.readFileSync(skill, "utf8"), /local addition/);
    });
  });

  it("retains shared skills and scripts until the last owner uninstalls", () => {
    withTempRoot("pro-skill-shared-", (options, root) => {
      install({ ...options, tools: ALL_TOOLS, withHooks: true });
      uninstall({ ...options, tools: ["claude", "pi"] });
      assert.equal(
        fs.existsSync(path.join(root, ".agents", "skills", "validation-loop", "SKILL.md")),
        true,
      );
      assert.equal(
        fs.existsSync(path.join(root, ".agents", "pro-skill", "guard-tests.mjs")),
        true,
      );
      assert.equal(
        status({ ...options, tools: ["antigravity"] })[0]?.hookInstalled,
        true,
      );
      uninstall({ ...options, tools: ["codex", "antigravity"] });
      assert.equal(
        fs.existsSync(path.join(root, ".agents", "skills", "validation-loop")),
        false,
      );
      assert.equal(
        fs.existsSync(path.join(root, ".agents", "pro-skill", "guard-tests.mjs")),
        false,
      );
    });
  });

  it("retains project rules used by remaining tools", () => {
    withTempRoot("pro-skill-proj-shared-", (options, root) => {
      const project = { ...options, scope: { kind: "project" as const, projectDir: root } };
      install({ ...project, tools: ["pi", "codex"] });
      uninstall({ ...project, tools: ["pi"] });
      assert.match(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), /pro-skill:start/);
    });
  });

  it("reports missing guard scripts and disabled hooks as uninstalled", () => {
    withTempRoot("pro-skill-status-", (options, root) => {
      const configured = { ...options, tools: ["antigravity"] as const, withHooks: true };
      install(configured);
      const configPath = path.join(root, ".gemini", "config", "hooks.json");
      const config = fs.readFileSync(configPath, "utf8");
      fs.writeFileSync(configPath, config.replace('"enabled": true', '"enabled": false'));
      assert.equal(status(configured)[0]?.hookInstalled, false);
      fs.writeFileSync(configPath, config);
      fs.unlinkSync(path.join(root, ".agents", "pro-skill", "guard-tests.mjs"));
      assert.equal(status(configured)[0]?.hookInstalled, false);
    });
  });

  it("installs Antigravity skills in its documented personal discovery directory", () => {
    withTempRoot("pro-skill-agy-", (options, root) => {
      install({ ...options, tools: ["antigravity"] });
      assert.equal(
        fs.existsSync(path.join(root, ".gemini", "config", "skills", "validation-loop", "SKILL.md")),
        true,
      );
      assert.equal(
        fs.existsSync(path.join(root, ".agents", "skills", "validation-loop")),
        false,
      );
    });
  });

  it("preserves link sources through updates, copy-mode conversion, and uninstall", () => {
    withTempRoot("pro-skill-link-", (options, root) => {
      const source = path.join(root, "package");
      fs.mkdirSync(path.join(source, "skills", "example"), { recursive: true });
      fs.mkdirSync(path.join(source, "rules"));
      fs.writeFileSync(path.join(source, "rules", "core.md"), "rules");
      const sourceSkill = path.join(source, "skills", "example", "SKILL.md");
      fs.writeFileSync(sourceSkill, "original");
      const linked = { ...options, packageRoot: source, linkSkills: true };
      install(linked);
      fs.writeFileSync(sourceSkill, "updated source");
      assert.ok(install(linked).changes.every((change) => change.action === "unchanged"));
      uninstall(linked);
      assert.equal(fs.readFileSync(sourceSkill, "utf8"), "updated source");
      install(linked);
      install({ ...linked, linkSkills: false });
      uninstall(linked);
      assert.equal(fs.readFileSync(sourceSkill, "utf8"), "updated source");
    });
  });

  it("preflights invalid hook config and invalid skill names before installing", () => {
    withTempRoot("pro-skill-preflight-", (options, root) => {
      const config = path.join(root, ".claude", "settings.json");
      fs.mkdirSync(path.dirname(config), { recursive: true });
      fs.writeFileSync(config, "[]");
      assert.throws(
        () => install({ ...options, tools: ["claude"], withHooks: true }),
        /JSON|object/i,
      );
      assert.equal(fs.existsSync(path.join(root, ".claude", "CLAUDE.md")), false);
      assert.equal(fs.readFileSync(config, "utf8"), "[]");

      const badPkg = path.join(root, "bad-pkg");
      fs.mkdirSync(path.join(badPkg, "skills", "Bad_Name"), { recursive: true });
      fs.mkdirSync(path.join(badPkg, "rules"));
      fs.writeFileSync(path.join(badPkg, "rules", "core.md"), "rules");
      fs.writeFileSync(path.join(badPkg, "skills", "Bad_Name", "SKILL.md"), "x");
      assert.throws(
        () => install({ ...options, packageRoot: badPkg }),
        /Invalid bundled skill name/,
      );
    });
  });

  it("preserves modified guard scripts and refuses malformed ownership state", () => {
    withTempRoot("pro-skill-state-", (options, root) => {
      const hooked = { ...options, tools: ["claude"] as const, withHooks: true };
      install(hooked);
      const script = path.join(root, ".agents", "pro-skill", "guard-tests.mjs");
      fs.appendFileSync(script, "\n// custom guard\n");
      assert.throws(() => install(hooked), /modified/);
      uninstall(hooked);
      assert.match(fs.readFileSync(script, "utf8"), /custom guard/);

      const state = path.join(root, ".agents", "pro-skill", "install-state.json");
      fs.mkdirSync(path.dirname(state), { recursive: true });
      fs.writeFileSync(
        state,
        JSON.stringify({
          version: 1,
          tools: ["codex"],
          resources: [
            {
              kind: "skill",
              path: "../outside",
              fingerprint: "dir:invalid",
              owners: ["codex"],
            },
          ],
        }),
      );
      assert.throws(() => uninstall(options), /Unsafe install state path/);
      assert.throws(() => install(options), /Unsafe install state path/);
    });
  });

  it("refuses skill ancestors redirected outside the scope through a junction", () => {
    withTempRoot("pro-skill-junction-", (options, root) => {
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), "pro-skill-outside-"));
      try {
        fs.mkdirSync(path.join(root, ".agents"), { recursive: true });
        fs.symlinkSync(
          outside,
          path.join(root, ".agents", "skills"),
          process.platform === "win32" ? "junction" : "dir",
        );
        assert.throws(() => install(options), /escapes installation scope/);
        assert.deepEqual(fs.readdirSync(outside), []);
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    });
  });

  it("runs the real CLI cleanly for install, status, preserved detail, errors, and uninstall", () => {
    withTempRoot("pro-skill-cli-", (_options, root) => {
      const run = (...args: string[]) =>
        spawnSync(process.execPath, [CLI_ENTRY, ...args, "--project", root], {
          encoding: "utf8",
        });

      const installed = run("install", "--with-hooks");
      assert.equal(installed.status, 0, installed.stderr);
      assert.match(installed.stdout, /created/);

      const st = run("status");
      assert.equal(st.status, 0, st.stderr);
      assert.match(st.stdout, /4\/4 installed/);

      const stateFile = path.join(root, ".agents", "pro-skill", "install-state.json");
      const before = fs.readFileSync(stateFile, "utf8");
      const dryUninstall = run("uninstall", "--dry-run");
      assert.equal(dryUninstall.status, 0, dryUninstall.stderr);
      assert.match(dryUninstall.stdout, /dry-run/);
      assert.equal(fs.readFileSync(stateFile, "utf8"), before);

      // Modify a skill to verify clean CLI error (no stack trace) and preserved detail on uninstall
      const skillFile = path.join(root, ".agents", "skills", "validation-loop", "SKILL.md");
      fs.appendFileSync(skillFile, "\n// user edit\n");

      const failedReinstall = run("install", "--with-hooks");
      assert.equal(failedReinstall.status, 1);
      assert.match(failedReinstall.stderr, /^Error: Refusing to overwrite locally modified resource/);
      assert.doesNotMatch(failedReinstall.stderr, /\bat\s+/);

      const uninstalled = run("uninstall");
      assert.equal(uninstalled.status, 0, uninstalled.stderr);
      assert.match(uninstalled.stdout, /preserved\s+skill.*Local modifications preserved/);
      assert.equal(fs.existsSync(path.join(root, "AGENTS.md")), false);
    });
  });
});
