export const BLOCK_START = "<!-- pro-skill:start -->";
export const BLOCK_END = "<!-- pro-skill:end -->";

export interface ManagedBlockResult {
  readonly content: string;
  readonly status: "created" | "updated" | "unchanged" | "removed";
}

function detectEol(text: string): "\r\n" | "\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function normalizeEol(text: string, eol: "\r\n" | "\n"): string {
  return text.replace(/\r\n/g, "\n").replace(/\n/g, eol);
}

function findBlockRange(content: string): { start: number; end: number } | null {
  const start = content.indexOf(BLOCK_START);
  if (start === -1) return null;
  const endMarkerIdx = content.indexOf(BLOCK_END, start + BLOCK_START.length);
  if (endMarkerIdx === -1) return null;
  return { start, end: endMarkerIdx + BLOCK_END.length };
}

export function hasManagedBlock(content: string): boolean {
  return findBlockRange(content) !== null;
}

export function upsertManagedBlock(
  existing: string | null,
  rulesBody: string,
): ManagedBlockResult {
  const eol = existing !== null && existing.length > 0 ? detectEol(existing) : "\n";
  const cleanBody = normalizeEol(rulesBody.trim(), eol);
  const renderedBlock = `${BLOCK_START}${eol}${cleanBody}${eol}${BLOCK_END}`;

  if (existing === null || existing.trim().length === 0) {
    return {
      content: `${renderedBlock}${eol}`,
      status: "created",
    };
  }

  const range = findBlockRange(existing);
  if (range !== null) {
    const next =
      existing.slice(0, range.start) +
      renderedBlock +
      existing.slice(range.end);
    if (next === existing) {
      return { content: existing, status: "unchanged" };
    }
    return { content: next, status: "updated" };
  }

  const trimmedEnd = existing.replace(/[ \t]*(\r?\n)*$/, "");
  const next = `${trimmedEnd}${eol}${eol}${renderedBlock}${eol}`;
  return { content: next, status: "updated" };
}

export function removeManagedBlock(existing: string): ManagedBlockResult {
  const range = findBlockRange(existing);
  if (range === null) {
    return { content: existing, status: "unchanged" };
  }

  const eol = detectEol(existing);
  const before = existing.slice(0, range.start).replace(/[ \t]*(\r?\n)*$/, "");
  const after = existing.slice(range.end).replace(/^(\r?\n)*/, "");

  let next = "";
  if (before.length > 0 && after.length > 0) {
    next = `${before}${eol}${eol}${after}`;
  } else if (before.length > 0) {
    next = `${before}${eol}`;
  } else if (after.length > 0) {
    next = after;
  }

  return { content: next, status: "removed" };
}
