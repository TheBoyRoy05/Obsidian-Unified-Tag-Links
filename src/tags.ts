// No lookbehind: a regex literal using it is a syntax error on iOS before 16.4, which would stop the plugin loading.
const TAG_IN_LINE = /(^|\s)(#[\p{L}\p{N}_/-]+)/gu;
const ALL_DIGITS = /^#\d+$/;

export const stripHash = (tag: string): string => tag.replace(/^#/, "");
export const canonical = (tag: string): string => stripHash(tag).toLowerCase();
export const isTagAlias = (alias: unknown): alias is string => typeof alias === "string" && alias.startsWith("#");

export function ancestryDeepestFirst(tag: string): string[] {
  const parts = canonical(tag).split("/");
  return parts.map((_, i) => parts.slice(0, parts.length - i).join("/"));
}

export function tagAt(line: string, ch: number): string | null {
  for (const match of line.matchAll(TAG_IN_LINE)) {
    const tag = match[2] ?? "";
    const start = (match.index ?? 0) + (match[1] ?? "").length;
    if (ch >= start && ch <= start + tag.length && !ALL_DIGITS.test(tag)) return stripHash(tag);
  }
  return null;
}
