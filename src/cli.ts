#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { install, status, uninstall, update } from "./installer.js";
import {
  ALL_TOOLS,
  isToolId,
  type InstallScope,
  type ToolId,
} from "./types.js";

type Command = "install" | "update" | "uninstall" | "status" | "help";

interface ParsedCli {
  readonly command: Command;
  readonly scope: InstallScope;
  readonly tools: readonly ToolId[];
  readonly withHooks: boolean;
  readonly linkSkills: boolean;
  readonly adopt: boolean;
  readonly dryRun: boolean;
}

const HELP_TEXT = `pro-skill - Install engineering discipline rules, skills, and optional test-guard hooks

Usage:
  pro-skill install [options]
  pro-skill update [--global | --project <dir>] [--dry-run]
  pro-skill uninstall [options]
  pro-skill status [options]

Options:
  --global                 Target global user config dirs (default)
  --project <dir>          Target a specific repository/project directory
  --tools <list>           Comma-separated tools: claude,pi,antigravity,codex (default: all)
  --with-hooks             Also install the optional test-tampering guard hook (Claude Code & Antigravity)
  --link                   Symlink/junction skills from this repo instead of copying
  --adopt                  Adopt/overwrite existing unmanaged or modified skills/scripts into install state
  --dry-run                Print planned changes without writing anything
  -h, --help               Show this help message

update reinstalls every recorded tool with the hook and copy/link choices it was
installed with. To change those choices, run install with the new options.

Examples:
  pro-skill install --global --dry-run
  pro-skill install --global --tools claude,pi,antigravity,codex
  pro-skill install --project ./my-app --with-hooks
  pro-skill update --global
  pro-skill status --global
  pro-skill uninstall --global
`;

function resolvePackageRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // dist/src/cli.js -> repo root is two levels up
  return path.resolve(path.dirname(thisFile), "..", "..");
}

function parseTools(raw: string): readonly ToolId[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  if (parts.length === 0) {
    throw new Error("--tools requires at least one tool name.");
  }
  const unique: ToolId[] = [];
  for (const part of parts) {
    if (!isToolId(part)) {
      throw new Error(
        `Unknown tool "${part}". Supported tools: ${ALL_TOOLS.join(", ")}`,
      );
    }
    if (!unique.includes(part)) {
      unique.push(part);
    }
  }
  return unique;
}

export function parseCliArgs(argv: readonly string[]): ParsedCli {
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    return {
      command: "help",
      scope: { kind: "global", homeDir: os.homedir() },
      tools: ALL_TOOLS,
      withHooks: false,
      linkSkills: false,
      adopt: false,
      dryRun: false,
    };
  }

  const first = argv[0];
  let command: Command;
  const startIdx = 1;

  if (first === "install" || first === "update" || first === "uninstall" || first === "status") {
    command = first;
  } else {
    throw new Error(
      `Unknown command "${first ?? ""}". Expected one of: install, update, uninstall, status`,
    );
  }

  let scope: InstallScope = { kind: "global", homeDir: os.homedir() };
  let tools: readonly ToolId[] = ALL_TOOLS;
  let withHooks = false;
  let linkSkills = false;
  let adopt = false;
  let dryRun = false;
  const installOnly: string[] = [];

  for (let i = startIdx; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--global") {
      scope = { kind: "global", homeDir: os.homedir() };
    } else if (arg === "--project") {
      const dir = argv[i + 1];
      if (!dir || dir.startsWith("-")) {
        throw new Error("--project requires a directory path.");
      }
      scope = { kind: "project", projectDir: path.resolve(dir) };
      i++;
    } else if (arg === "--tools") {
      const raw = argv[i + 1];
      if (!raw || raw.startsWith("-")) {
        throw new Error("--tools requires a comma-separated list of tools.");
      }
      tools = parseTools(raw);
      installOnly.push(arg);
      i++;
    } else if (arg === "--with-hooks") {
      withHooks = true;
      installOnly.push(arg);
    } else if (arg === "--link") {
      linkSkills = true;
      installOnly.push(arg);
    } else if (arg === "--adopt") {
      adopt = true;
      installOnly.push(arg);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else {
      throw new Error(`Unknown option: ${arg ?? ""}`);
    }
  }

  if (command === "update" && installOnly.length > 0) {
    throw new Error(
      `update reuses the recorded options and does not accept ${installOnly.join(", ")}. Run install to change them.`,
    );
  }

  return { command, scope, tools, withHooks, linkSkills, adopt, dryRun };
}

function main(): void {
  let parsed: ParsedCli;
  try {
    parsed = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n\nRun "pro-skill --help" for usage.\n`,
    );
    process.exit(1);
  }

  if (parsed.command === "help") {
    process.stdout.write(HELP_TEXT);
    return;
  }

  const packageRoot = resolvePackageRoot();

  try {
    if (parsed.command === "status") {
      const reports = status({
        scope: parsed.scope,
        tools: parsed.tools,
        packageRoot,
      });
      const scopeLabel =
        parsed.scope.kind === "global"
          ? `global (${parsed.scope.homeDir})`
          : `project (${parsed.scope.projectDir})`;
      process.stdout.write(`pro-skill status [${scopeLabel}]\n\n`);
      for (const r of reports) {
        const rulesBadge = r.rulesInstalled ? "installed" : "missing";
        const skillsBadge =
          r.missingSkills.length === 0
            ? `${r.installedSkills.length}/${r.installedSkills.length} installed`
            : `${r.installedSkills.length}/${r.installedSkills.length + r.missingSkills.length} (missing: ${r.missingSkills.join(", ")})`;
        const hookBadge = !r.hookSupported
          ? "n/a"
          : r.hookInstalled
            ? "installed"
            : "off";
        process.stdout.write(`- ${r.tool}\n`);
        process.stdout.write(`  rules : ${rulesBadge} (${r.rulesFile})\n`);
        process.stdout.write(`  skills: ${skillsBadge} (${r.skillsDir})\n`);
        process.stdout.write(
          `  hooks : ${hookBadge}${r.hookConfigPath ? ` (${r.hookConfigPath})` : ""}\n`,
        );
      }
      return;
    }

    const result =
      parsed.command === "install"
        ? install({
            scope: parsed.scope,
            tools: parsed.tools,
            withHooks: parsed.withHooks,
            linkSkills: parsed.linkSkills,
            adopt: parsed.adopt,
            dryRun: parsed.dryRun,
            packageRoot,
          })
        : parsed.command === "update"
          ? update({ scope: parsed.scope, dryRun: parsed.dryRun, packageRoot })
          : uninstall({
            scope: parsed.scope,
            tools: parsed.tools,
            dryRun: parsed.dryRun,
            packageRoot,
          });

    const prefix = result.dryRun ? "[dry-run] " : "";
    if (result.changes.length === 0) {
      process.stdout.write(`${prefix}Nothing to change.\n`);
      return;
    }

    for (const change of result.changes) {
      const detail =
        change.action === "preserved" && change.detail
          ? ` (${change.detail})`
          : "";
      process.stdout.write(
        `${prefix}${change.action.padEnd(9)} ${change.kind.padEnd(6)} ${change.path}${detail}\n`,
      );
    }
  } catch (err) {
    process.stderr.write(
      `Error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}

export function sameFile(a: string, b: string): boolean {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    // Unresolvable path (missing, permissions, loop): never throw here, or the guard would fail open.
    return path.resolve(a) === path.resolve(b);
  }
}

// Compare real paths: npm link and global installs start this file through a symlink or junction.
const isDirectExecution =
  process.argv[1] !== undefined && sameFile(process.argv[1], fileURLToPath(import.meta.url));

if (isDirectExecution) {
  main();
}
