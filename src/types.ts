export const ALL_TOOLS = ["claude", "pi", "antigravity", "codex"] as const;

export type ToolId = (typeof ALL_TOOLS)[number];

export type InstallScope =
  | { readonly kind: "global"; readonly homeDir: string }
  | { readonly kind: "project"; readonly projectDir: string };

export interface InstallOptions {
  readonly scope: InstallScope;
  readonly tools: readonly ToolId[];
  readonly withHooks: boolean;
  readonly linkSkills: boolean;
  readonly dryRun: boolean;
  readonly adopt?: boolean;
  readonly packageRoot: string;
}

export interface UninstallOptions {
  readonly scope: InstallScope;
  readonly tools: readonly ToolId[];
  readonly dryRun: boolean;
  readonly packageRoot: string;
}

export interface StatusOptions {
  readonly scope: InstallScope;
  readonly tools: readonly ToolId[];
  readonly packageRoot: string;
}

export type HookFormat = "claude-settings" | "antigravity-hooks";

export interface HookTarget {
  readonly format: HookFormat;
  readonly configPath: string;
  readonly scriptInstallPath: string;
}

export interface ToolTarget {
  readonly tool: ToolId;
  readonly rulesFile: string;
  readonly skillsDir: string;
  readonly hook?: HookTarget;
}

export interface ChangeRecord {
  readonly kind: "rules" | "skill" | "script" | "hook";
  readonly action: "created" | "updated" | "linked" | "removed" | "unchanged" | "preserved";
  readonly path: string;
  readonly detail?: string;
}

export interface OperationResult {
  readonly dryRun: boolean;
  readonly changes: readonly ChangeRecord[];
}

export interface ToolStatusReport {
  readonly tool: ToolId;
  readonly rulesFile: string;
  readonly rulesInstalled: boolean;
  readonly skillsDir: string;
  readonly installedSkills: readonly string[];
  readonly missingSkills: readonly string[];
  readonly hookSupported: boolean;
  readonly hookConfigPath?: string;
  readonly hookInstalled: boolean;
}

export function isToolId(value: string): value is ToolId {
  return (ALL_TOOLS as readonly string[]).includes(value);
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export interface UpdateOptions {
  readonly scope: InstallScope;
  readonly dryRun: boolean;
  readonly packageRoot: string;
}
