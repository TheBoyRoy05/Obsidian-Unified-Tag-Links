import { Notice, Plugin, TFile, normalizePath, parseFrontMatterAliases, type EventRef, type Menu } from "obsidian";
import { ConceptIndex } from "./concept-index";
import { LinkSync } from "./link-sync";
import { isInFolders, type Settings } from "./settings";
import { canonical, isTagAlias, stripHash, tagAt } from "./tags";
import { CREATE_NEW, PromoteModal, type PromoteChoice } from "./ui/promote-modal";
import { SettingsTab } from "./ui/settings-tab";

// Tag Wrangler fires this from the menu it builds for the tag pane and for editor tags.
declare module "obsidian" {
  interface Workspace {
    on(name: "tag-wrangler:contextmenu", callback: (menu: Menu, tagName: string) => unknown, ctx?: unknown): EventRef;
  }
}

// Lets a tag finish being typed before the note is rewritten, so "#Obs" never links on its way to "#Obsidian".
const EDIT_SETTLE_MS = 2000;

export default class UnifiedTagLinks extends Plugin {
  settings: Settings = { excludedFolders: [] };
  ready = false;
  private conceptIndex = new ConceptIndex(this.app, (file) => this.isExcluded(file));
  private linkSync = new LinkSync(this.app, this.conceptIndex, (file) => this.isExcluded(file));
  private pendingSyncs = new Map<string, number>();
  private pendingFullSync: number | undefined;
  private menusWithPromote = new WeakSet<Menu>();

  async onload(): Promise<void> {
    this.settings = { excludedFolders: [], ...((await this.loadData()) as Partial<Settings> | null) };

    this.addSettingTab(new SettingsTab(this));
    this.addCommand({ id: "resync", name: "Resync all notes", callback: () => this.fullSync(true) });
    this.addCommand({
      id: "demote",
      name: "Demote this concept note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || this.conceptIndex.tagAliasesOf(file).length === 0) return false;
        if (!checking) void this.demote(file);
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        const tag = tagAt(editor.getLine(editor.getCursor().line), editor.getCursor().ch);
        if (tag) this.addPromoteItem(menu, tag);
      })
    );
    this.registerEvent(this.app.workspace.on("tag-wrangler:contextmenu", (menu, tag) => this.addPromoteItem(menu, tag)));

    this.registerEvent(this.app.metadataCache.on("changed", (file) => this.onFileChanged(file)));
    this.registerEvent(
      this.app.metadataCache.on("deleted", () => {
        if (this.ready && this.conceptIndex.rebuild()) this.scheduleFullSync();
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file) => {
        if (file instanceof TFile) this.onFileChanged(file);
      })
    );

    this.app.workspace.onLayoutReady(() => {
      if (this.everyNoteIndexed()) return this.start();
      const ref = this.app.metadataCache.on("resolved", () => {
        this.app.metadataCache.offref(ref);
        this.start();
      });
      this.registerEvent(ref);
    });
  }

  onunload(): void {
    for (const timer of this.pendingSyncs.values()) window.clearTimeout(timer);
    window.clearTimeout(this.pendingFullSync);
  }

  isExcluded(file: TFile): boolean {
    return isInFolders(file, this.settings.excludedFolders);
  }

  conceptNoteName(tag: string): string {
    return tag.split("/").join(" ");
  }

  scheduleFullSync(): void {
    window.clearTimeout(this.pendingFullSync);
    this.pendingFullSync = window.setTimeout(() => void this.fullSync(false), EDIT_SETTLE_MS);
  }

  async promote(tag: string, choice: PromoteChoice): Promise<void> {
    const file = choice === CREATE_NEW ? await this.createConceptNote(tag) : choice;
    await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
      const aliases = parseFrontMatterAliases(frontmatter) ?? [];
      if (!aliases.some((alias) => isTagAlias(alias) && canonical(alias) === canonical(tag))) aliases.push("#" + tag);
      frontmatter.aliases = aliases;
      delete frontmatter.alias;
    });
    new Notice(`Promoted #${tag} to ${file.basename}`);
  }

  private start(): void {
    if (this.ready) return;
    this.ready = true;
    void this.fullSync(false);
  }

  private everyNoteIndexed(): boolean {
    return this.app.vault.getMarkdownFiles().every((file) => this.app.metadataCache.getFileCache(file));
  }

  private onFileChanged(file: TFile): void {
    if (!this.ready || file.extension !== "md") return;
    if (this.conceptIndex.rebuild()) this.scheduleFullSync();
    else this.scheduleSync(file);
  }

  private scheduleSync(file: TFile): void {
    window.clearTimeout(this.pendingSyncs.get(file.path));
    const timer = window.setTimeout(() => {
      this.pendingSyncs.delete(file.path);
      void this.linkSync.sync(file);
    }, EDIT_SETTLE_MS);
    this.pendingSyncs.set(file.path, timer);
  }

  private async fullSync(announce: boolean): Promise<void> {
    for (const timer of this.pendingSyncs.values()) window.clearTimeout(timer);
    this.pendingSyncs.clear();
    this.conceptIndex.rebuild();
    let updated = 0;
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (await this.linkSync.sync(file)) updated++;
    }
    if (announce) new Notice(`Unified Tag Links: ${updated} note(s) updated`);
  }

  private addPromoteItem(menu: Menu, rawTag: string): void {
    const tag = stripHash(rawTag);
    if (this.menusWithPromote.has(menu) || this.conceptIndex.has(tag)) return;
    this.menusWithPromote.add(menu);
    menu.addItem((item) =>
      item
        .setTitle(`Promote #${tag}`)
        .setIcon("arrow-up-circle")
        .onClick(() => new PromoteModal(this, tag).open())
    );
  }

  private async demote(file: TFile): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
      const aliases = (parseFrontMatterAliases(frontmatter) ?? []).filter((alias) => !isTagAlias(alias));
      if (aliases.length) frontmatter.aliases = aliases;
      else delete frontmatter.aliases;
      delete frontmatter.alias;
    });
    new Notice(`Demoted ${file.basename}`);
  }

  private async createConceptNote(tag: string): Promise<TFile> {
    const name = this.conceptNoteName(tag);
    const existing = this.app.metadataCache.getFirstLinkpathDest(name, "");
    if (existing) return existing;
    const folder = this.app.fileManager.getNewFileParent("");
    return this.app.vault.create(normalizePath(`${folder.path}/${name}.md`), "");
  }
}
