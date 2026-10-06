// Runtime stand-in for the "obsidian" package, which ships types only. Covers just what src/ calls.

interface Frontmatter {
  tags?: string[];
  aliases?: unknown;
  alias?: unknown;
  [key: string]: unknown;
}

export class TFile {
  constructor(public path: string) {}
  get basename(): string {
    return this.path.split("/").pop()!.replace(/\.md$/, "");
  }
  get extension(): string {
    return "md";
  }
}

export function getAllTags(cache: { frontmatter?: Frontmatter; tags?: { tag: string }[] }): string[] {
  const inline = (cache.tags ?? []).map((t) => t.tag);
  const front = (cache.frontmatter?.tags ?? []).map((t) => "#" + t);
  return [...front, ...inline];
}

export function parseFrontMatterAliases(frontmatter: Frontmatter | undefined): string[] | null {
  const value = frontmatter?.aliases ?? frontmatter?.alias;
  if (value === undefined) return null;
  return ([value].flat() as unknown[]).filter((a): a is string => typeof a === "string");
}

export class MockVault {
  readonly files = new Map<string, { file: TFile; frontmatter: Frontmatter; inlineTags: string[] }>();
  writes = 0;

  add(path: string, frontmatter: Frontmatter = {}, inlineTags: string[] = []): TFile {
    const file = new TFile(path);
    this.files.set(path, { file, frontmatter, inlineTags });
    return file;
  }

  frontmatter(file: TFile): Frontmatter {
    return this.files.get(file.path)!.frontmatter;
  }

  readonly app = {
    vault: { getMarkdownFiles: () => [...this.files.values()].map((entry) => entry.file) },
    metadataCache: {
      getFileCache: (file: TFile) => {
        const entry = this.files.get(file.path);
        return entry && { frontmatter: entry.frontmatter, tags: entry.inlineTags.map((tag) => ({ tag })) };
      },
      getFirstLinkpathDest: (linkpath: string) =>
        [...this.files.values()].find((e) => e.file.basename === linkpath || e.file.path === linkpath)?.file ?? null,
      fileToLinktext: (file: TFile) => file.basename,
    },
    fileManager: {
      processFrontMatter: async (file: TFile, fn: (frontmatter: Frontmatter) => void) => {
        this.writes++;
        fn(this.frontmatter(file));
      },
    },
  };
}
