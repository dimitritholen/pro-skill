import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isToolId, type InstallScope, type ToolId } from "./types.js";

export interface OwnedResource {
  readonly kind: "skill" | "script";
  readonly path: string;
  readonly fingerprint: string;
  readonly owners: readonly ToolId[];
}

export interface InstallState {
  readonly version: 1;
  readonly tools: readonly ToolId[];
  readonly resources: readonly OwnedResource[];
}

export function scopeRoot(scope: InstallScope): string {
  return path.resolve(scope.kind === "global" ? scope.homeDir : scope.projectDir);
}

export function statePath(scope: InstallScope): string {
  return path.join(scopeRoot(scope), ".agents", "pro-skill", "install-state.json");
}

function canonicalPath(target: string): string {
  let existing = path.resolve(target);
  const missing: string[] = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) throw new Error(`Cannot resolve path: ${target}`);
    missing.unshift(path.basename(existing));
    existing = parent;
  }
  return path.join(fs.realpathSync(existing), ...missing);
}

export function assertSafePath(scope: InstallScope, target: string, allowLeafLink = false): void {
  // Resolve ancestors before any recursive deletion; a junction must not redirect it outside this scope.
  const root = canonicalPath(scopeRoot(scope));
  const parent = canonicalPath(path.dirname(target));
  const relative = path.relative(root, parent);
  if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    throw new Error(`Resource parent escapes installation scope: ${target}`);
  }
  if (!allowLeafLink) {
    try {
      if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`Refusing to write through linked file: ${target}`);
    } catch (err) {
      if (!(err instanceof Error && "code" in err && err.code === "ENOENT")) throw err;
    }
  }
}

export function fingerprint(target: string): string | null {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(target);
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") return null;
    throw err;
  }
  // Track the link, not its changing source content. Never traverse nested links.
  if (stat.isSymbolicLink()) return `link:${path.resolve(path.dirname(target), fs.readlinkSync(target))}`;
  if (stat.isFile()) return `file:${createHash("sha256").update(fs.readFileSync(target)).digest("hex")}`;
  if (!stat.isDirectory()) throw new Error(`Unsupported resource: ${target}`);
  const entries = fs.readdirSync(target).sort().map((name) => [name, fingerprint(path.join(target, name))]);
  return `dir:${createHash("sha256").update(JSON.stringify(entries)).digest("hex")}`;
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid install state object");
  return value as Record<string, unknown>;
}

function tools(value: unknown): ToolId[] {
  if (!Array.isArray(value) || !value.every((item: unknown) => typeof item === "string" && isToolId(item))) {
    throw new Error("Invalid install state tools");
  }
  return value as ToolId[];
}

export function readState(scope: InstallScope): InstallState {
  const file = statePath(scope);
  assertSafePath(scope, file);
  if (!fs.existsSync(file)) return { version: 1, tools: [], resources: [] };
  const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  const root = object(parsed);
  if (root["version"] !== 1 || !Array.isArray(root["resources"])) throw new Error("Unsupported install state");
  const resources = root["resources"].map((entry: unknown): OwnedResource => {
    const rec = object(entry);
    const kind = rec["kind"];
    const resourcePath = rec["path"];
    const hash = rec["fingerprint"];
    if ((kind !== "skill" && kind !== "script") || typeof resourcePath !== "string" || typeof hash !== "string") {
      throw new Error("Invalid install state resource");
    }
    const absolute = path.resolve(scopeRoot(scope), resourcePath);
    const relative = path.relative(scopeRoot(scope), absolute).replace(/\\/g, "/");
    const allowed = kind === "script" ? relative === ".agents/pro-skill/guard-tests.mjs"
      : /^(\.agents|\.claude|\.gemini\/config)\/skills\/[a-z0-9][a-z0-9-]*$/.test(relative);
    if (!allowed) throw new Error(`Unsafe install state path: ${resourcePath}`);
    assertSafePath(scope, absolute, kind === "skill");
    return { kind, path: absolute, fingerprint: hash, owners: tools(rec["owners"]) };
  });
  return { version: 1, tools: tools(root["tools"]), resources };
}

export function writeState(scope: InstallScope, state: InstallState): void {
  const file = statePath(scope);
  if (state.tools.length === 0 && state.resources.length === 0) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const serialized = JSON.stringify({ ...state, resources: state.resources.map((resource) => ({
    ...resource, path: path.relative(scopeRoot(scope), resource.path),
  })) }, null, 2) + "\n";
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, serialized, "utf8");
  fs.renameSync(temporary, file);
}

export function assertWritable(target: string, state: InstallState): void {
  const current = fingerprint(target);
  if (current === null) return;
  const owned = state.resources.find((resource) => resource.path === path.resolve(target));
  if (!owned) throw new Error(`Refusing to overwrite unmanaged resource: ${target}. Move it aside before installing.`);
  if (owned.fingerprint !== current) throw new Error(`Refusing to overwrite locally modified resource: ${target}. Save or move your changes first.`);
}
