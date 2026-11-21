import type { HookFormat } from "./types.js";
import { assertNever } from "./types.js";

export const ANTIGRAVITY_HOOK_KEY = "pro-skill-guard-tests";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function buildCommand(scriptPath: string, harness: "claude" | "antigravity"): string {
  const normalized = scriptPath.replace(/\\/g, "/");
  if (/["`$%\r\n]/.test(normalized)) throw new Error("Hook script path contains unsupported shell characters");
  return `node "${normalized}" --harness ${harness}`;
}

export function isHookInstalled(rawJson: string | null, format: HookFormat, scriptPath?: string): boolean {
  if (rawJson === null || rawJson.trim().length === 0) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return false;
  }
  const root = asObject(parsed);

  switch (format) {
    case "antigravity-hooks": {
      const entry = asObject(root[ANTIGRAVITY_HOOK_KEY]);
      if (entry["enabled"] === false || !Array.isArray(entry["PreToolUse"])) return false;
      return entry["PreToolUse"].some((group: unknown) => {
        const handlers = asObject(group)["hooks"];
        return Array.isArray(handlers) && handlers.some((handler: unknown) => {
          const rec = asObject(handler);
          return typeof rec["command"] === "string" &&
            (scriptPath === undefined || rec["command"] === buildCommand(scriptPath, "antigravity"));
        });
      });
    }

    case "claude-settings": {
      const hooks = asObject(root["hooks"]);
      const preToolUse = hooks["PreToolUse"];
      if (!Array.isArray(preToolUse)) return false;
      return preToolUse.some((entry) => {
        const handlers = asObject(entry)["hooks"];
        return Array.isArray(handlers) && handlers.some((handler: unknown) => isProSkillClaudeHandler(handler, scriptPath));
      });
    }

    default:
      return assertNever(format);
  }
}

function isProSkillClaudeHandler(handler: unknown, scriptPath?: string): boolean {
  const rec = asObject(handler);
  const command = rec["command"];
  if (typeof command !== "string" || rec["type"] !== "command") return false;
  if (scriptPath !== undefined) return command === buildCommand(scriptPath, "claude");
  return /^node "[^"\r\n]*\/\.agents\/pro-skill\/guard-tests\.mjs" --harness claude$/.test(command);
}

function withoutManagedHandlers(entries: readonly unknown[], scriptPath?: string): unknown[] {
  return entries.flatMap((entry: unknown) => {
    const obj = asObject(entry);
    const handlers = obj["hooks"];
    if (!Array.isArray(handlers)) return [entry];
    const remaining = handlers.filter((handler: unknown) => !isProSkillClaudeHandler(handler, scriptPath));
    if (remaining.length === handlers.length) return [entry];
    return remaining.length === 0 ? [] : [{ ...obj, hooks: remaining }];
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
      const parsed: unknown = JSON.parse(rawJson);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object");
      root = asObject(parsed);
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
              "^(edit_file|write_file|write_to_file|replace_file_content|multi_replace_file_content)$",
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
      if (root["hooks"] !== undefined && (root["hooks"] === null || typeof root["hooks"] !== "object" || Array.isArray(root["hooks"]))) {
        throw new Error("Refusing to overwrite invalid hooks object");
      }
      const existingHooks = asObject(root["hooks"]);
      if (existingHooks["PreToolUse"] !== undefined && !Array.isArray(existingHooks["PreToolUse"])) {
        throw new Error("Refusing to overwrite invalid PreToolUse handlers");
      }
      const existingPre = Array.isArray(existingHooks["PreToolUse"])
        ? withoutManagedHandlers(existingHooks["PreToolUse"], scriptPath)
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
  scriptPath?: string,
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
      const remaining = withoutManagedHandlers(existingPre, scriptPath);
      if (JSON.stringify(remaining) === JSON.stringify(existingPre)) {
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
