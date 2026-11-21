import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { it } from "node:test";
import { install, uninstall, status } from "../src/installer.js";
import { upsertHookConfig, removeHookConfig } from "../src/hooks-config.js";
import type { InstallOptions } from "../src/types.js";

function fixture(run: (options: InstallOptions, root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pro-skill-review-"));
  try {
    run({ scope: { kind: "global", homeDir: root }, tools: ["codex"],
      packageRoot: process.cwd(), dryRun: false, withHooks: false, linkSkills: false }, root);
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

it("refuses unmanaged skill collisions before changing rules, including dry-run", () => fixture((options, root) => {
  const skill = path.join(root, ".agents/skills/validation-loop/SKILL.md");
  fs.mkdirSync(path.dirname(skill), { recursive: true });
  fs.writeFileSync(skill, "user skill");
  for (const dryRun of [true, false]) {
    assert.throws(() => install({ ...options, dryRun }), /unmanaged/i);
    assert.equal(fs.readFileSync(skill, "utf8"), "user skill");
    assert.equal(fs.existsSync(path.join(root, ".codex/AGENTS.md")), false);
  }
  uninstall(options);
  assert.equal(fs.readFileSync(skill, "utf8"), "user skill");
}));

it("preserves modified installed skills on update and uninstall", () => fixture((options, root) => {
  install(options);
  const skill = path.join(root, ".agents/skills/validation-loop/SKILL.md");
  fs.appendFileSync(skill, "\nlocal addition");
  assert.throws(() => install(options), /modified/i);
  const result = uninstall(options);
  assert.ok(result.changes.some((change) => change.path === path.dirname(skill) && String(change.action) === "preserved"));
  assert.match(fs.readFileSync(skill, "utf8"), /local addition/);
}));

it("retains shared skills and scripts until the last owner uninstalls", () => fixture((options, root) => {
  install({ ...options, tools: ["claude", "pi", "codex", "antigravity"], withHooks: true });
  uninstall({ ...options, tools: ["claude", "pi"] });
  assert.equal(fs.existsSync(path.join(root, ".agents/skills/validation-loop/SKILL.md")), true);
  assert.equal(fs.existsSync(path.join(root, ".agents/pro-skill/guard-tests.mjs")), true);
  assert.equal(status({ ...options, tools: ["antigravity"] })[0]?.hookInstalled, true);
  uninstall({ ...options, tools: ["codex", "antigravity"] });
  assert.equal(fs.existsSync(path.join(root, ".agents/skills/validation-loop")), false);
  assert.equal(fs.existsSync(path.join(root, ".agents/pro-skill/guard-tests.mjs")), false);
}));

it("retains project rules used by remaining tools", () => fixture((options, root) => {
  const project = { ...options, scope: { kind: "project" as const, projectDir: root } };
  install({ ...project, tools: ["pi", "codex"] });
  uninstall({ ...project, tools: ["pi"] });
  assert.match(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), /pro-skill:start/);
}));

it("reports missing guard scripts and disabled hooks as uninstalled", () => fixture((options, root) => {
  const configured = { ...options, tools: ["antigravity"] as const, withHooks: true };
  install(configured);
  const configPath = path.join(root, ".gemini/config/hooks.json");
  const config = fs.readFileSync(configPath, "utf8");
  fs.writeFileSync(configPath, config.replace('"enabled": true', '"enabled": false'));
  assert.equal(status(configured)[0]?.hookInstalled, false);
  fs.writeFileSync(configPath, config);
  fs.unlinkSync(path.join(root, ".agents/pro-skill/guard-tests.mjs"));
  assert.equal(status(configured)[0]?.hookInstalled, false);
}));

it("keeps unrelated guard filenames and sibling handlers when updating/removing hooks", () => {
  const script = "/home/demo/.agents/pro-skill/guard-tests.mjs";
  const command = `node "${script}" --harness claude`;
  const existing = JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Edit", hooks: [
    { type: "command", command }, { type: "command", command: "echo preserve-me" },
    { type: "command", command: "node /mine/guard-tests.mjs" },
  ] }] } });
  for (const content of [upsertHookConfig(existing, "claude-settings", script).content,
    removeHookConfig(existing, "claude-settings").content]) {
    assert.ok(content?.includes("preserve-me"));
    assert.ok(content?.includes("/mine/guard-tests.mjs"));
  }
});

it("matches Antigravity's documented overwrite tool", () => {
  const content: unknown = JSON.parse(upsertHookConfig(null, "antigravity-hooks", "/guard.mjs").content);
  assert.match(JSON.stringify(content), /write_to_file/);
  const config = content as Record<string, { PreToolUse: { matcher: string }[] }>;
  const pattern = config["pro-skill-guard-tests"]?.PreToolUse[0]?.matcher;
  assert.ok(pattern);
  assert.equal(new RegExp(pattern).test("write_to_file"), true);
  assert.equal(new RegExp(pattern).test("unrelated_write_to_file_tool"), false);
});

it("installs Antigravity skills in its documented personal discovery directory", () => fixture((options, root) => {
  install({ ...options, tools: ["antigravity"] });
  assert.equal(fs.existsSync(path.join(root, ".gemini/config/skills/validation-loop/SKILL.md")), true);
  assert.equal(fs.existsSync(path.join(root, ".agents/skills/validation-loop")), false);
}));

it("preserves link sources through updates, copy-mode conversion, and uninstall", () => fixture((options, root) => {
  const source = path.join(root, "package");
  fs.mkdirSync(path.join(source, "skills/example"), { recursive: true });
  fs.mkdirSync(path.join(source, "rules"));
  fs.writeFileSync(path.join(source, "rules/core.md"), "rules");
  const sourceSkill = path.join(source, "skills/example/SKILL.md");
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
}));

it("preflights invalid hook config before installing rules or skills", () => fixture((options, root) => {
  const config = path.join(root, ".claude/settings.json");
  fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, "[]");
  assert.throws(() => install({ ...options, tools: ["claude"], withHooks: true }), /JSON|object/i);
  assert.equal(fs.existsSync(path.join(root, ".claude/CLAUDE.md")), false);
  assert.equal(fs.readFileSync(config, "utf8"), "[]");
}));

it("preserves modified guard scripts and refuses malformed ownership state", () => fixture((options, root) => {
  const hooked = { ...options, tools: ["claude"] as const, withHooks: true };
  install(hooked);
  const script = path.join(root, ".agents/pro-skill/guard-tests.mjs");
  fs.appendFileSync(script, "\n// custom guard\n");
  assert.throws(() => install(hooked), /modified/);
  uninstall(hooked);
  assert.match(fs.readFileSync(script, "utf8"), /custom guard/);
  const state = path.join(root, ".agents/pro-skill/install-state.json");
  fs.writeFileSync(state, JSON.stringify({ version: 1, tools: ["codex"], resources: [
    { kind: "skill", path: "../outside", fingerprint: "dir:invalid", owners: ["codex"] },
  ] }));
  assert.throws(() => uninstall(options), /Unsafe install state path/);
  assert.throws(() => install(options), /Unsafe install state path/);
}));

it("refuses skill ancestors redirected outside the scope through a junction", () => fixture((options, root) => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "pro-skill-outside-"));
  try {
    fs.mkdirSync(path.join(root, ".agents"), { recursive: true });
    fs.symlinkSync(outside, path.join(root, ".agents/skills"), process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => install(options), /escapes installation scope/);
    assert.deepEqual(fs.readdirSync(outside), []);
  } finally { fs.rmSync(outside, { recursive: true, force: true }); }
}));

it("runs the real CLI install, status, dry-run uninstall, and uninstall in a disposable project", () => fixture((_options, root) => {
  const cli = path.join(process.cwd(), "dist/src/cli.js");
  const run = (...args: string[]) => {
    const result = spawnSync(process.execPath, [cli, ...args, "--project", root], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  assert.match(run("install", "--with-hooks"), /created/);
  assert.match(run("status"), /4\/4 installed/);
  const before = fs.readFileSync(path.join(root, ".agents/pro-skill/install-state.json"), "utf8");
  assert.match(run("uninstall", "--dry-run"), /dry-run/);
  assert.equal(fs.readFileSync(path.join(root, ".agents/pro-skill/install-state.json"), "utf8"), before);
  assert.match(run("uninstall"), /removed/);
  assert.equal(fs.existsSync(path.join(root, "AGENTS.md")), false);
}));

it("rejects malformed nested hook configuration without discarding data", () => {
  for (const content of [JSON.stringify({ hooks: [] }), JSON.stringify({ hooks: { PreToolUse: {} } })]) {
    assert.throws(() => upsertHookConfig(content, "claude-settings", "/guard.mjs"), /invalid/);
  }
});
