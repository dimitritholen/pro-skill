import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANTIGRAVITY_HOOK_KEY,
  isHookInstalled,
  removeHookConfig,
  upsertHookConfig,
} from "../src/hooks-config.js";

describe("hooks-config", () => {
  it("merges and removes Claude Code PreToolUse hook while preserving unrelated settings", () => {
    const existing = JSON.stringify(
      {
        theme: "dark",
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo user-hook" }],
            },
          ],
          Stop: [{ hooks: [{ type: "command", command: "echo done" }] }],
        },
      },
      null,
      2,
    );

    const added = upsertHookConfig(
      existing,
      "claude-settings",
      "C:\\Users\\demo\\.agents\\pro-skill\\guard-tests.mjs",
    );
    assert.equal(added.status, "updated");
    assert.equal(isHookInstalled(added.content, "claude-settings"), true);

    const parsed = JSON.parse(added.content) as {
      theme: string;
      hooks: { PreToolUse: unknown[]; Stop: unknown[] };
    };
    assert.equal(parsed.theme, "dark");
    assert.equal(parsed.hooks.PreToolUse.length, 2);
    assert.equal(parsed.hooks.Stop.length, 1);

    // Idempotent second call
    const second = upsertHookConfig(
      added.content,
      "claude-settings",
      "C:\\Users\\demo\\.agents\\pro-skill\\guard-tests.mjs",
    );
    assert.equal(second.status, "unchanged");

    // Clean removal restores user's hooks without deleting them
    const removed = removeHookConfig(added.content, "claude-settings");
    assert.equal(removed.status, "removed");
    assert.notEqual(removed.content, null);
    assert.equal(isHookInstalled(removed.content, "claude-settings"), false);

    const after = JSON.parse(removed.content!) as {
      theme: string;
      hooks: { PreToolUse: unknown[]; Stop: unknown[] };
    };
    assert.equal(after.theme, "dark");
    assert.equal(after.hooks.PreToolUse.length, 1);
    assert.equal(after.hooks.Stop.length, 1);
  });

  it("merges and removes Antigravity hooks.json while preserving other named hooks", () => {
    const existing = JSON.stringify(
      {
        "user-linter": {
          PostToolUse: [
            {
              matcher: "run_command",
              hooks: [{ type: "command", command: "./lint.sh" }],
            },
          ],
        },
      },
      null,
      2,
    );

    const added = upsertHookConfig(
      existing,
      "antigravity-hooks",
      "/home/demo/.agents/pro-skill/guard-tests.mjs",
    );
    assert.equal(added.status, "updated");
    assert.equal(isHookInstalled(added.content, "antigravity-hooks"), true);

    const parsed = JSON.parse(added.content) as Record<string, unknown>;
    assert.ok("user-linter" in parsed);
    assert.ok(ANTIGRAVITY_HOOK_KEY in parsed);

    const removed = removeHookConfig(added.content, "antigravity-hooks");
    assert.equal(removed.status, "removed");
    assert.notEqual(removed.content, null);
    const after = JSON.parse(removed.content!) as Record<string, unknown>;
    assert.ok("user-linter" in after);
    assert.equal(ANTIGRAVITY_HOOK_KEY in after, false);
  });

  it("returns null on removal when hook config becomes empty", () => {
    const created = upsertHookConfig(
      null,
      "antigravity-hooks",
      "/tmp/guard-tests.mjs",
    );
    assert.equal(created.status, "created");

    const removed = removeHookConfig(created.content, "antigravity-hooks");
    assert.equal(removed.status, "removed");
    assert.equal(removed.content, null);
  });
});
