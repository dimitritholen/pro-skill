import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BLOCK_END,
  BLOCK_START,
  hasManagedBlock,
  removeManagedBlock,
  upsertManagedBlock,
} from "../src/managed-block.js";

describe("managed-block", () => {
  it("creates a delimited block when target file does not exist", () => {
    const res = upsertManagedBlock(null, "# Core Rules\n- Rule 1");
    assert.equal(res.status, "created");
    assert.equal(hasManagedBlock(res.content), true);
    assert.equal(
      res.content,
      `${BLOCK_START}\n# Core Rules\n- Rule 1\n${BLOCK_END}\n`,
    );
  });

  it("appends non-destructively to existing user rules", () => {
    const existing = "# My Custom Rules\nAlways use pnpm.\n";
    const res = upsertManagedBlock(existing, "# Core Rules\n- Rule 1");
    assert.equal(res.status, "updated");
    assert.ok(res.content.startsWith("# My Custom Rules\nAlways use pnpm.\n\n"));
    assert.ok(res.content.includes(BLOCK_START));
    assert.ok(res.content.includes("- Rule 1"));
    assert.ok(res.content.includes(BLOCK_END));
  });

  it("is idempotent when re-applied with identical rules", () => {
    const first = upsertManagedBlock("# User\nKeep this.\n", "Rule A");
    const second = upsertManagedBlock(first.content, "Rule A");
    assert.equal(second.status, "unchanged");
    assert.equal(second.content, first.content);
  });

  it("updates only the managed block in place while preserving surrounding text", () => {
    const initial = `# Top\n\n${BLOCK_START}\nOld\n${BLOCK_END}\n\n# Bottom\n`;
    const updated = upsertManagedBlock(initial, "New");
    assert.equal(updated.status, "updated");
    assert.equal(
      updated.content,
      `# Top\n\n${BLOCK_START}\nNew\n${BLOCK_END}\n\n# Bottom\n`,
    );
  });

  it("preserves CRLF line endings when existing file uses CRLF", () => {
    const existing = "# Windows\r\nRule 0\r\n";
    const res = upsertManagedBlock(existing, "Line 1\nLine 2");
    assert.equal(res.status, "updated");
    assert.ok(res.content.includes("\r\n"));
    assert.equal(res.content.replace(/\r\n/g, "").includes("\n"), false);
  });

  it("removes only the managed block and preserves user content", () => {
    const existing = "# User\nKeep this.\n";
    const installed = upsertManagedBlock(existing, "Managed body");
    const removed = removeManagedBlock(installed.content);
    assert.equal(removed.status, "removed");
    assert.equal(removed.content, existing);
    assert.equal(hasManagedBlock(removed.content), false);
  });

  it("returns empty string when managed block was the entire file", () => {
    const created = upsertManagedBlock(null, "Only managed");
    const removed = removeManagedBlock(created.content);
    assert.equal(removed.status, "removed");
    assert.equal(removed.content, "");
  });
});
