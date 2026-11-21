import type { HookFormat } from "./types.js";
import { assertNever } from "./types.js";

export const ANTIGRAVITY_HOOK_KEY = "pro-skill-guard-tests";
const CLAUDE_HOOK_MARKER = "guard-tests.mjs";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function buildCommand(scriptPath: string, harness: "claude" | "antigravity"): string {
  const normalized = scriptPath.replace(/\\/g, "/");
  return `node "${normalized}" --harness ${harness}`;
}

export function isHookInstalled(rawJson: string | null, format: HookFormat): boolean {
  if (rawJson === null || rawJson.trim().length === 0) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return false;
  }
  const root = asObject(parsed);

  switch (format) {
    case "antigravity-hooks":
      return Object.prototype.hasOwnProperty.call(root, ANTIGRAVITY_HOOK_KEY);

    case "claude-settings": {
      const hooks = asObject(root["hooks"]);
      const preToolUse = hooks["PreToolUse"];
      if (!Array.isArray(preToolUse)) return false;
      return preToolUse.some((entry) => isProSkillClaudeEntry(entry));
    }

    default:
      return assertNever(format);
  }
}

function isProSkillClaudeEntry(entry: unknown): boolean {
  const obj = asObject(entry);
  const hooks = obj["hooks"];
  if (!Array.isArray(hooks)) return false;
  return hooks.some((h) => {
    const rec = asObject(h);
    return (
      typeof rec["command"] === "string" &&
      rec["command"].includes(CLAUDE_HOOK_MARKER)
    );
  });
}

export function upsertHookConfig(
  rawJson: string | null,
  format: HookFormat,
  scriptPath: string,
): { readonly content: string; readonly status: "created" | "updated" | "unchanged" } {
  const existed = rawJson !== null && rawJson.trim().length > 0;
  let root: JsonObject = {};
  if (existed) {
    try {
      root = asObject(JSON.parse(rawJson));
    } catch (err) {
      throw new Error(
        `Refusing to overwrite invalid JSON config: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  let nextRoot: JsonObject;

  switch (format) {
    case "antigravity-hooks": {
      const hookEntry = {
        enabled: true,
        PreToolUse: [
          {
            matcher:
              "edit_file|write_file|replace_file_content|multi_replace_file_content",
            hooks: [
              {
                type: "command",
                command: buildCommand(scriptPath, "antigravity"),
                timeout: 10,
              },
            ],
          },
        ],
      };
      nextRoot = {
        ...root,
        [ANTIGRAVITY_HOOK_KEY]: hookEntry,
      };
      break;
    }

    case "claude-settings": {
      const existingHooks = asObject(root["hooks"]);
      const existingPre = Array.isArray(existingHooks["PreToolUse"])
        ? existingHooks["PreToolUse"].filter((e) => !isProSkillClaudeEntry(e))
        : [];
      const newEntry = {
        matcher: "Edit|Write|MultiEdit",
        hooks: [
          {
            type: "command",
            command: buildCommand(scriptPath, "claude"),
            timeout: 10,
          },
        ],
      };
      nextRoot = {
        ...root,
        hooks: {
          ...existingHooks,
          PreToolUse: [...existingPre, newEntry],
        },
      };
      break;
    }

    default:
      assertNever(format);
  }

  const nextContent = JSON.stringify(nextRoot, null, 2) + "\n";
  if (existed && rawJson === nextContent) {
    return { content: nextContent, status: "unchanged" };
  }
  return {
    content: nextContent,
    status: existed ? "updated" : "created",
  };
}

export function removeHookConfig(
  rawJson: string | null,
  format: HookFormat,
): { readonly content: string | null; readonly status: "removed" | "unchanged" } {
  if (rawJson === null || rawJson.trim().length === 0) {
    return { content: rawJson, status: "unchanged" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { content: rawJson, status: "unchanged" };
  }

  const root = asObject(parsed);

  switch (format) {
    case "antigravity-hooks": {
      if (!Object.prototype.hasOwnProperty.call(root, ANTIGRAVITY_HOOK_KEY)) {
        return { content: rawJson, status: "unchanged" };
      }
      const nextRoot: JsonObject = { ...root };
      delete nextRoot[ANTIGRAVITY_HOOK_KEY];
      if (Object.keys(nextRoot).length === 0) {
        return { content: null, status: "removed" };
      }
      return { content: JSON.stringify(nextRoot, null, 2) + "\n", status: "removed" };
    }

    case "claude-settings": {
      const hooks = asObject(root["hooks"]);
      const existingPre = hooks["PreToolUse"];
      if (!Array.isArray(existingPre)) {
        return { content: rawJson, status: "unchanged" };
      }
      const remaining = existingPre.filter((e) => !isProSkillClaudeEntry(e));
      if (remaining.length === existingPre.length) {
        return { content: rawJson, status: "unchanged" };
      }

      const nextHooks: JsonObject = { ...hooks };
      if (remaining.length === 0) {
        delete nextHooks["PreToolUse"];
      } else {
        nextHooks["PreToolUse"] = remaining;
      }

      const nextRoot: JsonObject = { ...root };
      if (Object.keys(nextHooks).length === 0) {
        delete nextRoot["hooks"];
      } else {
        nextRoot["hooks"] = nextHooks;
      }

      if (Object.keys(nextRoot).length === 0) {
        return { content: null, status: "removed" };
      }
      return { content: JSON.stringify(nextRoot, null, 2) + "\n", status: "removed" };
    }

    default:
      return assertNever(format);
  }
}
