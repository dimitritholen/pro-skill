import fs from "node:fs";
import path from "node:path";
import { assertSafePath, assertWritable, fingerprint, readState, writeState, type OwnedResource } from "./install-state.js";
import {
  isHookInstalled,
  removeHookConfig,
  upsertHookConfig,
} from "./hooks-config.js";
import {
  hasManagedBlock,
  removeManagedBlock,
  upsertManagedBlock,
} from "./managed-block.js";
import { resolveTargets } from "./targets.js";
import type {
  ChangeRecord,
  InstallOptions,
  OperationResult,
  StatusOptions,
  ToolStatusReport,
  UninstallOptions,
} from "./types.js";

export function listBundledSkills(packageRoot: string): readonly string[] {
  const skillsRoot = path.join(packageRoot, "skills");
  if (!fs.existsSync(skillsRoot)) return [];
  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(skillsRoot, entry.name, "SKILL.md")),
    )
    .map((entry) => entry.name)
    .sort();
}

function readOptionalFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function directoriesEqual(dirA: string, dirB: string): boolean {
  if (!fs.existsSync(dirA) || !fs.existsSync(dirB)) return false;
  const entriesA = fs.readdirSync(dirA, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const entriesB = fs.readdirSync(dirB, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  if (entriesA.length !== entriesB.length) return false;

  for (let i = 0; i < entriesA.length; i++) {
    const a = entriesA[i];
    const b = entriesB[i];
    if (!a || !b || a.name !== b.name) return false;
    const pathA = path.join(dirA, a.name);
    const pathB = path.join(dirB, b.name);
    if (a.isDirectory() && b.isDirectory()) {
      if (!directoriesEqual(pathA, pathB)) return false;
    } else if (a.isFile() && b.isFile()) {
      if (!fs.readFileSync(pathA).equals(fs.readFileSync(pathB))) return false;
    } else {
      return false;
    }
  }
  return true;
}

function syncSkillDirectory(
  srcDir: string,
  destDir: string,
  linkSkills: boolean,
  dryRun: boolean,
): ChangeRecord {
  const exists = fs.existsSync(destDir);
  let isSymlink = false;
  try {
    isSymlink = fs.lstatSync(destDir).isSymbolicLink();
  } catch {
    isSymlink = false;
  }

  if (linkSkills) {
    if (isSymlink) {
      const currentTarget = fs.readlinkSync(destDir);
      if (path.resolve(path.dirname(destDir), currentTarget) === path.resolve(srcDir)) {
        return { kind: "skill", action: "unchanged", path: destDir };
      }
    }
    if (!dryRun) {
      fs.mkdirSync(path.dirname(destDir), { recursive: true });
      if (exists || isSymlink) {
        fs.rmSync(destDir, { recursive: true, force: true });
      }
      const linkType = process.platform === "win32" ? "junction" : "dir";
      fs.symlinkSync(srcDir, destDir, linkType);
    }
    return { kind: "skill", action: "linked", path: destDir };
  }

  if (exists && !isSymlink && directoriesEqual(srcDir, destDir)) {
    return { kind: "skill", action: "unchanged", path: destDir };
  }

  if (!dryRun) {
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    if (exists || isSymlink) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
    fs.cpSync(srcDir, destDir, { recursive: true });
  }

  return {
    kind: "skill",
    action: exists || isSymlink ? "updated" : "created",
    path: destDir,
  };
}

export function install(options: InstallOptions): OperationResult {
  const rulesPath = path.join(options.packageRoot, "rules", "core.md");
  const rulesBody = fs.readFileSync(rulesPath, "utf8");
  const skillNames = listBundledSkills(options.packageRoot);
  const targets = resolveTargets(options.tools, options.scope);

  const state = readState(options.scope);
  const resources = new Map(state.resources.map((resource) => [resource.path, resource]));
  // Preflight every collision and config before any writes, including dry-runs.
  for (const target of targets) {
    assertSafePath(options.scope, target.rulesFile);
    for (const skillName of skillNames) {
      const dest = path.join(target.skillsDir, skillName);
      assertSafePath(options.scope, dest, true);
      assertWritable(dest, state);
    }
    if (options.withHooks && target.hook) {
      assertSafePath(options.scope, target.hook.configPath);
      assertSafePath(options.scope, target.hook.scriptInstallPath);
      assertWritable(target.hook.scriptInstallPath, state);
      upsertHookConfig(readOptionalFile(target.hook.configPath), target.hook.format, target.hook.scriptInstallPath);
    }
  }
  function remember(target: string, kind: OwnedResource["kind"], owner: typeof options.tools[number]): void {
    if (options.dryRun) return;
    const key = path.resolve(target);
    const hash = fingerprint(key);
    if (hash === null) throw new Error(`Installed resource missing: ${key}`);
    resources.set(key, { path: key, kind, fingerprint: hash,
      owners: [...new Set([...(resources.get(key)?.owners ?? []), owner])] });
  }

  const changes: ChangeRecord[] = [];
  const seenRuleFiles = new Set<string>();
  const seenSkillDirs = new Set<string>();
  const seenScripts = new Set<string>();
  const seenHookConfigs = new Set<string>();

  for (const target of targets) {
    // 1. Rules (managed block)
    const ruleKey = path.resolve(target.rulesFile);
    if (!seenRuleFiles.has(ruleKey)) {
      seenRuleFiles.add(ruleKey);
      const existing = readOptionalFile(target.rulesFile);
      const res = upsertManagedBlock(existing, rulesBody);
      if (res.status !== "unchanged" && !options.dryRun) {
        ensureParentDir(target.rulesFile);
        fs.writeFileSync(target.rulesFile, res.content, "utf8");
      }
      changes.push({
        kind: "rules",
        action: res.status === "removed" ? "updated" : res.status,
        path: target.rulesFile,
      });
    }

    // 2. Skills
    const skillDirKey = path.resolve(target.skillsDir);
    if (!seenSkillDirs.has(skillDirKey)) {
      seenSkillDirs.add(skillDirKey);
      for (const skillName of skillNames) {
        const src = path.join(options.packageRoot, "skills", skillName);
        const dest = path.join(target.skillsDir, skillName);
        changes.push(
          syncSkillDirectory(src, dest, options.linkSkills, options.dryRun),
        );
      }
    }
    for (const skillName of skillNames) remember(path.join(target.skillsDir, skillName), "skill", target.tool);

    // 3. Optional guard hooks
    if (options.withHooks && target.hook) {
      const srcScript = path.join(options.packageRoot, "scripts", "guard-tests.mjs");
      const scriptKey = path.resolve(target.hook.scriptInstallPath);
      if (!seenScripts.has(scriptKey)) {
        seenScripts.add(scriptKey);
        const srcContent = fs.readFileSync(srcScript, "utf8");
        const existingScript = readOptionalFile(target.hook.scriptInstallPath);
        if (existingScript === srcContent) {
          changes.push({
            kind: "script",
            action: "unchanged",
            path: target.hook.scriptInstallPath,
          });
        } else {
          if (!options.dryRun) {
            ensureParentDir(target.hook.scriptInstallPath);
            fs.writeFileSync(target.hook.scriptInstallPath, srcContent, "utf8");
          }
          changes.push({
            kind: "script",
            action: existingScript === null ? "created" : "updated",
            path: target.hook.scriptInstallPath,
          });
        }
      }
      remember(target.hook.scriptInstallPath, "script", target.tool);

      const hookKey = path.resolve(target.hook.configPath);
      if (!seenHookConfigs.has(hookKey)) {
        seenHookConfigs.add(hookKey);
        const existingConfig = readOptionalFile(target.hook.configPath);
        const res = upsertHookConfig(
          existingConfig,
          target.hook.format,
          target.hook.scriptInstallPath,
        );
        if (res.status !== "unchanged" && !options.dryRun) {
          ensureParentDir(target.hook.configPath);
          fs.writeFileSync(target.hook.configPath, res.content, "utf8");
        }
        changes.push({
          kind: "hook",
          action: res.status,
          path: target.hook.configPath,
          detail: target.tool,
        });
      }
    }
  }

  if (!options.dryRun) writeState(options.scope, { version: 1,
    tools: [...new Set([...state.tools, ...options.tools])], resources: [...resources.values()] });
  return { dryRun: options.dryRun, changes };
}

export function uninstall(options: UninstallOptions): OperationResult {
  const state = readState(options.scope);
  const removing = options.tools.filter((tool) => state.tools.includes(tool));
  const remainingTools = state.tools.filter((tool) => !removing.includes(tool));
  const remainingTargets = resolveTargets(remainingTools, options.scope);
  const targets = resolveTargets(removing, options.scope);
  const retainedResources: OwnedResource[] = [];
  for (const target of targets) {
    assertSafePath(options.scope, target.rulesFile);
    if (target.hook) assertSafePath(options.scope, target.hook.configPath);
  }

  const changes: ChangeRecord[] = [];
  const seenRuleFiles = new Set<string>();
  const seenHookConfigs = new Set<string>();

  for (const resource of state.resources) {
    const owners = resource.owners.filter((tool) => !removing.includes(tool));
    if (owners.length > 0) {
      retainedResources.push({ ...resource, owners });
      continue;
    }
    const current = fingerprint(resource.path);
    if (current === null) continue;
    if (current !== resource.fingerprint) {
      changes.push({ kind: resource.kind, action: "preserved", path: resource.path,
        detail: "Local modifications preserved; resource is now unmanaged." });
      continue;
    }
    if (!options.dryRun) fs.rmSync(resource.path, { recursive: resource.kind === "skill", force: true });
    changes.push({ kind: resource.kind, action: "removed", path: resource.path });
  }

  for (const target of targets) {
    // 1. Rules
    const ruleKey = path.resolve(target.rulesFile);
    if (!seenRuleFiles.has(ruleKey) && !remainingTargets.some((other) => path.resolve(other.rulesFile) === ruleKey)) {
      seenRuleFiles.add(ruleKey);
      const existing = readOptionalFile(target.rulesFile);
      if (existing !== null) {
        const res = removeManagedBlock(existing);
        if (res.status === "removed") {
          if (!options.dryRun) {
            if (res.content.trim().length === 0) {
              fs.unlinkSync(target.rulesFile);
            } else {
              fs.writeFileSync(target.rulesFile, res.content, "utf8");
            }
          }
          changes.push({
            kind: "rules",
            action: "removed",
            path: target.rulesFile,
          });
        } else {
          changes.push({
            kind: "rules",
            action: "unchanged",
            path: target.rulesFile,
          });
        }
      }
    }

    // Hooks are private to each integration; resource ownership handles scripts.
    if (target.hook) {
      const hookKey = path.resolve(target.hook.configPath);
      if (!seenHookConfigs.has(hookKey)) {
        seenHookConfigs.add(hookKey);
        const existingConfig = readOptionalFile(target.hook.configPath);
        const res = removeHookConfig(existingConfig, target.hook.format, target.hook.scriptInstallPath);
        if (res.status === "removed") {
          if (!options.dryRun) {
            if (res.content === null) {
              fs.unlinkSync(target.hook.configPath);
            } else {
              fs.writeFileSync(target.hook.configPath, res.content, "utf8");
            }
          }
          changes.push({
            kind: "hook",
            action: "removed",
            path: target.hook.configPath,
          });
        }
      }
    }
  }

  if (!options.dryRun) writeState(options.scope, { version: 1, tools: remainingTools, resources: retainedResources });
  return { dryRun: options.dryRun, changes };
}

export function status(options: StatusOptions): readonly ToolStatusReport[] {
  const skillNames = listBundledSkills(options.packageRoot);
  const targets = resolveTargets(options.tools, options.scope);

  return targets.map((target) => {
    const rulesContent = readOptionalFile(target.rulesFile);
    const rulesInstalled = rulesContent !== null && hasManagedBlock(rulesContent);

    const installedSkills: string[] = [];
    const missingSkills: string[] = [];
    for (const skillName of skillNames) {
      const skillFile = path.join(target.skillsDir, skillName, "SKILL.md");
      if (fs.existsSync(skillFile)) {
        installedSkills.push(skillName);
      } else {
        missingSkills.push(skillName);
      }
    }

    const hookSupported = target.hook !== undefined;
    const hookInstalled =
      target.hook !== undefined &&
      fs.existsSync(target.hook.scriptInstallPath) &&
      isHookInstalled(
        readOptionalFile(target.hook.configPath),
        target.hook.format,
        target.hook.scriptInstallPath,
      );

    return {
      tool: target.tool,
      rulesFile: target.rulesFile,
      rulesInstalled,
      skillsDir: target.skillsDir,
      installedSkills,
      missingSkills,
      hookSupported,
      ...(target.hook ? { hookConfigPath: target.hook.configPath } : {}),
      hookInstalled,
    };
  });
}
