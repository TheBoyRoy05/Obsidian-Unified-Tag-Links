import { parseFrontMatterAliases, type App, type TFile } from "obsidian";
import { canonical, aliasIsTag } from "./tags";

export const TAG_LINKS_EXCLUDE_PROPERTY = "tag_links_exclude";

export class ConceptIndex {
  private conceptNotesByTag = new Map<string, TFile[]>();
  private excludedTagsByNote = new Map<string, string[]>();
  private indexSignature = "";

  constructor(
    private readonly app: App,
    private readonly isExcluded: (file: TFile) => boolean
  ) {}

  has(tag: string): boolean {
    return this.conceptNotesByTag.has(canonical(tag));
  }

  conceptNotesFor(ancestorTag: string, linkingTag: string): TFile[] {
    return (this.conceptNotesByTag.get(ancestorTag) ?? []).filter((note) => !this.refuses(note, linkingTag));
  }

  private refuses(conceptNote: TFile, tag: string): boolean {
    const tagPath = canonical(tag);
    return (this.excludedTagsByNote.get(conceptNote.path) ?? []).some(
      (excluded) => tagPath === excluded || tagPath.startsWith(excluded + "/")
    );
  }

  tagAliasesOf(file: TFile): string[] {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return (parseFrontMatterAliases(frontmatter) ?? []).filter(aliasIsTag).map(canonical);
  }

  // Returns true when the set of concept notes changed, since only then can other notes' links change.
  rebuild(): boolean {
    const conceptNotesByTag = new Map<string, TFile[]>();
    const excludedTagsByNote = new Map<string, string[]>();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (this.isExcluded(file)) continue;
      const tags = this.tagAliasesOf(file);
      for (const tag of tags) {
        conceptNotesByTag.set(tag, [...(conceptNotesByTag.get(tag) ?? []), file]);
      }
      const excludedTags = this.excludedTagsOf(file);
      if (tags.length && excludedTags.length) excludedTagsByNote.set(file.path, excludedTags);
    }
    const indexSignature = [
      ...[...conceptNotesByTag].map(([tag, conceptNotes]) => tag + ">" + conceptNotes.map((note) => note.path).sort().join(",")),
      ...[...excludedTagsByNote].map(([path, excludedTags]) => path + "!" + excludedTags.join(",")),
    ]
      .sort()
      .join("\n");
    const changed = indexSignature !== this.indexSignature;
    this.conceptNotesByTag = conceptNotesByTag;
    this.excludedTagsByNote = excludedTagsByNote;
    this.indexSignature = indexSignature;
    return changed;
  }

  private excludedTagsOf(file: TFile): string[] {
    const value: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter?.[TAG_LINKS_EXCLUDE_PROPERTY];
    return [value]
      .flat()
      .filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "")
      .map((tag) => canonical(tag.trim()))
      .sort();
  }
}
