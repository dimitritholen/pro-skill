#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR_SEGMENTS = new Set([
  "__tests__",
  "tests",
  "test",
  "spec",
  "specs",
  "e2e",
]);

const TEST_FILE_PATTERNS = [
  /\.(test|spec|e2e)\.[^.]+$/i,
  /_test\.[^.]+$/i,
  /^test_[^/\\]+\.[^.]+$/i,
  /Tests?\.(cs|java|kt|swift)$/i,
];

/**
 * Determine whether a path looks like a test file.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isTestFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const base = path.posix.basename(normalized);
  if (TEST_FILE_PATTERNS.some((re) => re.test(base))) {
    return true;
  }
  const segments = normalized.split("/").slice(0, -1);
  return segments.some((seg) => TEST_DIR_SEGMENTS.has(seg.toLowerCase()));
}

/**
 * Check for a .pro-skill-lock-tests file from startDir up to stopDir.
 * @param {string} startDir
 * @param {string} stopDir
 * @returns {boolean}
 */
export function hasLockFile(startDir, stopDir) {
  let current = path.resolve(startDir);
  const boundary = path.resolve(stopDir);
  while (true) {
    if (fs.existsSync(path.join(current, ".pro-skill-lock-tests"))) {
      return true;
    }
    if (current === boundary) {
      return false;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return false;
    }
    current = parent;
  }
}

/** @param {string} startDir */
function repositoryBoundary(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
}

/**
 * Extract target file path from Claude Code or Antigravity PreToolUse payload.
 * @param {unknown} payload
 * @param {"claude" | "antigravity"} harness
 * @returns {string | null}
 */
export function extractTargetPath(payload, harness) {
  if (!payload || typeof payload !== "object") return null;
  const obj = /** @type {Record<string, unknown>} */ (payload);

  if (harness === "claude") {
    const input = obj["tool_input"];
    if (input && typeof input === "object") {
      const rec = /** @type {Record<string, unknown>} */ (input);
      for (const key of ["file_path", "path", "target_file"]) {
        if (typeof rec[key] === "string" && rec[key].length > 0) {
          return rec[key];
        }
      }
    }
    return null;
  }

  const toolCall = obj["toolCall"];
  if (toolCall && typeof toolCall === "object") {
    const args = /** @type {Record<string, unknown>} */ (toolCall)["args"];
    if (args && typeof args === "object") {
      const rec = /** @type {Record<string, unknown>} */ (args);
      for (const key of ["Path", "TargetFile", "file_path", "path"]) {
        if (typeof rec[key] === "string" && rec[key].length > 0) {
          return rec[key];
        }
      }
    }
  }
  return null;
}

/**
 * Evaluate whether an edit should be allowed, prompted, or denied.
 * @param {unknown} payload
 * @param {"claude" | "antigravity"} harness
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ action: "allow" | "ask" | "deny"; reason?: string }}
 */
export function evaluateGuard(payload, harness, env = process.env) {
  const rawMode = (env["PRO_SKILL_TEST_GUARD"] ?? "").trim().toLowerCase();
  const mode = rawMode.length === 0 ? "ask" : rawMode;
  if (mode === "off") {
    return { action: "allow" };
  }

  const obj = payload && typeof payload === "object"
    ? /** @type {Record<string, unknown>} */ (payload) : {};
  const workspaces = Array.isArray(obj["workspacePaths"]) ? obj["workspacePaths"] : [];
  const cwd =
    typeof obj["cwd"] === "string" ? obj["cwd"]
      : typeof workspaces[0] === "string" ? workspaces[0] : process.cwd();
  const boundary = repositoryBoundary(cwd);
  const rawPath = extractTargetPath(payload, harness);
  if (!["ask", "deny"].includes(mode) || !rawPath) {
    return { action: mode !== "ask" || hasLockFile(cwd, boundary) ? "deny" : "ask",
      reason: "pro-skill could not interpret the edit payload or guard mode. Check the hook integration before proceeding." };
  }

  const resolvedPath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(cwd, rawPath);

  const realPath = fs.existsSync(resolvedPath) ? fs.realpathSync(resolvedPath) : resolvedPath;
  if (!isTestFile(resolvedPath) && !isTestFile(realPath)) {
    return { action: "allow" };
  }

  // Creating a brand-new test file is always encouraged.
  if (!fs.existsSync(resolvedPath)) {
    return { action: "allow" };
  }

  const strictLocked =
    mode === "deny" || hasLockFile(cwd, boundary) ||
    hasLockFile(path.dirname(resolvedPath), repositoryBoundary(path.dirname(resolvedPath))) ||
    hasLockFile(path.dirname(realPath), repositoryBoundary(path.dirname(realPath)));

  const relPath = path.relative(cwd, resolvedPath) || resolvedPath;

  if (strictLocked) {
    return {
      action: "deny",
      reason: `pro-skill test guard blocked editing existing test file "${relPath}". Tests are locked; fix the implementation or unlock tests after confirming a spec change with the user.`,
    };
  }

  return {
    action: "ask",
    reason: `pro-skill test guard: agent is modifying existing test file "${relPath}". Confirm this reflects an intentional spec change rather than weakening assertions to pass CI.`,
  };
}

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", () => resolve(""));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const harnessIdx = args.indexOf("--harness");
  const harnessArg = harnessIdx >= 0 ? args[harnessIdx + 1] : "claude";
  const harness = harnessArg === "antigravity" ? "antigravity" : "claude";

  const raw = (await readStdin()).trim();
  let payload = {};
  if (raw.length > 0) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {};
    }
  }

  let result;
  try {
    result = evaluateGuard(payload, harness, process.env);
  } catch (err) {
    result = { action: "deny", reason: `pro-skill could not inspect the edit: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (harness === "antigravity") {
    if (result.action === "allow") {
      process.stdout.write(JSON.stringify({ decision: "allow" }) + "\n");
      process.exit(0);
    }
    if (result.action === "deny") {
      process.stdout.write(
        JSON.stringify({ decision: "deny", reason: result.reason }) + "\n",
      );
      process.exit(0);
    }
    process.stdout.write(
      JSON.stringify({ decision: "force_ask", reason: result.reason }) + "\n",
    );
    process.exit(0);
  }

  // Claude Code contract
  if (result.action === "allow") {
    process.exit(0);
  }
  if (result.action === "deny") {
    process.stderr.write((result.reason ?? "Blocked by pro-skill test guard.") + "\n");
    process.exit(2);
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: result.reason,
      },
    }) + "\n",
  );
  process.exit(0);
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function sameFile(a, b) {
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
  void main();
}
