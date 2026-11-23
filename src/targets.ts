import path from "node:path";
import type { InstallScope, ToolId, ToolTarget } from "./types.js";
import { assertNever } from "./types.js";

export function resolveToolTarget(tool: ToolId, scope: InstallScope): ToolTarget {
  if (scope.kind === "global") {
    const home = scope.homeDir;
    const sharedSkillsDir = path.join(home, ".agents", "skills");
    const guardScriptPath = path.join(home, ".agents", "pro-skill", "guard-tests.mjs");

    switch (tool) {
      case "claude":
        return {
          tool,
          rulesFile: path.join(home, ".claude", "CLAUDE.md"),
          skillsDir: path.join(home, ".claude", "skills"),
          hook: {
            format: "claude-settings",
            configPath: path.join(home, ".claude", "settings.json"),
            scriptInstallPath: guardScriptPath,
          },
        };
      case "antigravity":
        return {
          tool,
          rulesFile: path.join(home, ".gemini", "config", "AGENTS.md"),
          skillsDir: path.join(home, ".gemini", "config", "skills"),
          hook: {
            format: "antigravity-hooks",
            configPath: path.join(home, ".gemini", "config", "hooks.json"),
            scriptInstallPath: guardScriptPath,
          },
        };
      case "codex":
        return {
          tool,
          rulesFile: path.join(home, ".codex", "AGENTS.md"),
          skillsDir: sharedSkillsDir,
        };
      default:
        return assertNever(tool);
    }
  }

  const root = scope.projectDir;
  const projectSkillsDir = path.join(root, ".agents", "skills");
  const guardScriptPath = path.join(root, ".agents", "pro-skill", "guard-tests.mjs");

  switch (tool) {
    case "claude":
      return {
        tool,
        rulesFile: path.join(root, "CLAUDE.md"),
        skillsDir: path.join(root, ".claude", "skills"),
        hook: {
          format: "claude-settings",
          configPath: path.join(root, ".claude", "settings.json"),
          scriptInstallPath: guardScriptPath,
        },
      };
    case "antigravity":
      return {
        tool,
        rulesFile: path.join(root, "AGENTS.md"),
        skillsDir: projectSkillsDir,
        hook: {
          format: "antigravity-hooks",
          configPath: path.join(root, ".agents", "hooks.json"),
          scriptInstallPath: guardScriptPath,
        },
      };
    case "codex":
      return {
        tool,
        rulesFile: path.join(root, "AGENTS.md"),
        skillsDir: projectSkillsDir,
      };
    default:
      return assertNever(tool);
  }
}

export function resolveTargets(
  tools: readonly ToolId[],
  scope: InstallScope,
): readonly ToolTarget[] {
  return tools.map((tool) => resolveToolTarget(tool, scope));
}
