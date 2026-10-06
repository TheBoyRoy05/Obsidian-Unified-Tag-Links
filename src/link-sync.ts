import { getAllTags, type App, type TFile } from "obsidian";
import type { ConceptIndex } from "./concept-index";
import { ancestryDeepestFirst } from "./tags";

export const TAG_LINKS_PROPERTY = "tag_links";

function sameKeys(a: Map<string, unknown>, b: Map<string, unknown>): boolean {
  return a.size === b.size && [...a.keys()].every((key) => b.has(key));
}

export class LinkSync {
  constructor(
    private readonly app: App,
    private readonly conceptIndex: ConceptIndex,
    private readonly isExcluded: (file: TFile) => boolean
  ) {}

  /** Writes `tag_links` only when the stored targets differ, so a settled vault costs no writes. */
  async sync(file: TFile): Promise<boolean> {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return false;

    const desiredConceptNotes = this.desiredConceptNotes(file);
    const storedTagLinks: unknown = cache.frontmatter?.[TAG_LINKS_PROPERTY];
    if (storedTagLinks === undefined && desiredConceptNotes.size === 0) return false;

    if (
      storedTagLinks !== undefined &&
      desiredConceptNotes.size > 0 &&
      sameKeys(desiredConceptNotes, this.storedConceptNotes(file, storedTagLinks))
    ) {
      return false;
    }

    const tagLinks = [...desiredConceptNotes.values()]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((note) => `[[${this.app.metadataCache.fileToLinktext(note, file.path, true)}]]`);

    await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
      if (tagLinks.length) frontmatter[TAG_LINKS_PROPERTY] = tagLinks;
      else delete frontmatter[TAG_LINKS_PROPERTY];
    });
    return true;
  }

  private desiredConceptNotes(file: TFile): Map<string, TFile> {
    const conceptNotesByPath = new Map<string, TFile>();
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache || this.isExcluded(file)) return conceptNotesByPath;

    const tags = [...(getAllTags(cache) ?? []), ...this.conceptIndex.tagAliasesOf(file)];
    for (const tag of tags) {
      for (const ancestorTag of ancestryDeepestFirst(tag)) {
        const conceptNotes = this.conceptIndex.conceptNotesFor(ancestorTag).filter((note) => note !== file);
        if (conceptNotes.length === 0) continue;

        for (const note of conceptNotes) conceptNotesByPath.set(note.path, note);
        break;
      }
    }
    return conceptNotesByPath;
  }

  // Keyed by the file each link resolves to, so a link Obsidian rewrote after a rename still counts as correct.
  private storedConceptNotes(file: TFile, storedTagLinks: unknown): Map<string, TFile | null> {
    const conceptNotesByPath = new Map<string, TFile | null>();
    for (const tagLink of [storedTagLinks].flat()) {
      if (typeof tagLink !== "string") continue;
      const linkpath = tagLink.replace(/^\[\[|\]\]$/g, "").split(/[|#]/)[0] ?? "";
      const resolved = this.app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
      conceptNotesByPath.set(resolved ? resolved.path : "unresolved:" + tagLink, resolved);
    }
    return conceptNotesByPath;
  }
}
