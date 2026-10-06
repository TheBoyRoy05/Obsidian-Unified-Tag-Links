import { parseFrontMatterAliases, type App, type TFile } from "obsidian";
import { canonical, isTagAlias } from "./tags";

export class ConceptIndex {
  private conceptNotesByTag = new Map<string, TFile[]>();
  private indexSignature = "";

  constructor(
    private readonly app: App,
    private readonly isExcluded: (file: TFile) => boolean
  ) {}

  has(tag: string): boolean {
    return this.conceptNotesByTag.has(canonical(tag));
  }

  conceptNotesFor(canonicalTag: string): TFile[] {
    return this.conceptNotesByTag.get(canonicalTag) ?? [];
  }

  tagAliasesOf(file: TFile): string[] {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return (parseFrontMatterAliases(frontmatter) ?? []).filter(isTagAlias).map(canonical);
  }

  // Returns true when the set of concept notes changed, since only then can other notes' links change.
  rebuild(): boolean {
    const conceptNotesByTag = new Map<string, TFile[]>();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (this.isExcluded(file)) continue;
      for (const tag of this.tagAliasesOf(file)) {
        conceptNotesByTag.set(tag, [...(conceptNotesByTag.get(tag) ?? []), file]);
      }
    }
    const indexSignature = [...conceptNotesByTag]
      .map(([tag, conceptNotes]) => tag + ">" + conceptNotes.map((note) => note.path).sort().join(","))
      .sort()
      .join("\n");
    const changed = indexSignature !== this.indexSignature;
    this.conceptNotesByTag = conceptNotesByTag;
    this.indexSignature = indexSignature;
    return changed;
  }
}
