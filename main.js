const {
  Plugin,
  PluginSettingTab,
  Setting,
  FuzzySuggestModal,
  Notice,
  getAllTags,
  parseFrontMatterAliases,
  normalizePath,
} = require("obsidian");

const PROPERTY = "tag_links";
// Lets a tag finish being typed before the note is rewritten, so "#Obs" never links on its way to "#Obsidian".
const EDIT_SETTLE_MS = 2000;
const TAG_IN_LINE = /(?<=^|\s)#[\p{L}\p{N}_/-]+/gu;
const CREATE_NEW = Symbol("create-new");

const stripHash = (tag) => tag.replace(/^#/, "");
const canonical = (tag) => stripHash(tag).toLowerCase();
const isTagAlias = (alias) => typeof alias === "string" && alias.startsWith("#");

function ancestryDeepestFirst(tag) {
  const parts = canonical(tag).split("/");
  return parts.map((_, i) => parts.slice(0, parts.length - i).join("/"));
}

function tagAtCursor(editor) {
  const { line, ch } = editor.getCursor();
  for (const match of editor.getLine(line).matchAll(TAG_IN_LINE)) {
    const end = match.index + match[0].length;
    if (ch >= match.index && ch <= end && !/^#\d+$/.test(match[0])) return stripHash(match[0]);
  }
  return null;
}

function sameKeys(a, b) {
  return a.size === b.size && [...a.keys()].every((key) => b.has(key));
}

module.exports = class UnifiedTagLinks extends Plugin {
  async onload() {
    this.settings = { excludedFolders: [], ...(await this.loadData()) };
    this.conceptNotes = new Map();
    this.conceptSignature = "";
    this.pendingSyncs = new Map();
    this.pendingFullSync = null;
    this.menusWithPromote = new WeakSet();
    this.ready = false;

    this.addSettingTab(new UnifiedTagLinksSettings(this.app, this));
    this.addCommand({ id: "resync", name: "Resync all notes", callback: () => this.fullSync(true) });
    this.addCommand({
      id: "demote",
      name: "Demote this concept note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || this.tagAliasesOf(file).length === 0) return false;
        if (!checking) this.demote(file);
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        const tag = tagAtCursor(editor);
        if (tag) this.addPromoteItem(menu, tag);
      })
    );
    this.registerEvent(this.app.workspace.on("tag-wrangler:contextmenu", (menu, tag) => this.addPromoteItem(menu, tag)));

    this.registerEvent(this.app.metadataCache.on("changed", (file) => this.onFileChanged(file)));
    this.registerEvent(this.app.metadataCache.on("deleted", () => this.ready && this.rebuildIndex() && this.scheduleFullSync()));
    this.registerEvent(this.app.vault.on("rename", (file) => this.onFileChanged(file)));

    this.app.workspace.onLayoutReady(() => {
      if (this.everyNoteIndexed()) return this.start();
      const ref = this.app.metadataCache.on("resolved", () => {
        this.app.metadataCache.offref(ref);
        this.start();
      });
      this.registerEvent(ref);
    });
  }

  onunload() {
    for (const timer of this.pendingSyncs.values()) window.clearTimeout(timer);
    window.clearTimeout(this.pendingFullSync);
  }

  start() {
    if (this.ready) return;
    this.ready = true;
    this.fullSync(false);
  }

  everyNoteIndexed() {
    return this.app.vault.getMarkdownFiles().every((file) => this.app.metadataCache.getFileCache(file));
  }

  isExcluded(file) {
    return this.settings.excludedFolders.some((folder) => {
      const prefix = folder.replace(/\/+$/, "");
      return prefix && (file.path === prefix || file.path.startsWith(prefix + "/"));
    });
  }

  tagAliasesOf(file) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return (parseFrontMatterAliases(frontmatter) ?? []).filter(isTagAlias).map(canonical);
  }

  // Returns true when the set of concept notes changed, since only then can other notes' links change.
  rebuildIndex() {
    const index = new Map();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (this.isExcluded(file)) continue;
      for (const tag of this.tagAliasesOf(file)) index.set(tag, [...(index.get(tag) ?? []), file]);
    }
    const signature = [...index]
      .map(([tag, files]) => tag + ">" + files.map((f) => f.path).join(","))
      .sort()
      .join("\n");
    const changed = signature !== this.conceptSignature;
    this.conceptNotes = index;
    this.conceptSignature = signature;
    return changed;
  }

  onFileChanged(file) {
    if (!this.ready || file.extension !== "md") return;
    if (this.rebuildIndex()) this.scheduleFullSync();
    else this.scheduleSync(file);
  }

  scheduleSync(file) {
    window.clearTimeout(this.pendingSyncs.get(file.path));
    const timer = window.setTimeout(() => {
      this.pendingSyncs.delete(file.path);
      this.sync(file);
    }, EDIT_SETTLE_MS);
    this.pendingSyncs.set(file.path, timer);
  }

  scheduleFullSync() {
    window.clearTimeout(this.pendingFullSync);
    this.pendingFullSync = window.setTimeout(() => this.fullSync(false), EDIT_SETTLE_MS);
  }

  async fullSync(announce) {
    for (const timer of this.pendingSyncs.values()) window.clearTimeout(timer);
    this.pendingSyncs.clear();
    this.rebuildIndex();
    let updated = 0;
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (await this.sync(file)) updated++;
    }
    if (announce) new Notice(`Unified Tag Links: ${updated} note(s) updated`);
  }

  desiredTargets(file) {
    const targets = new Map();
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache || this.isExcluded(file)) return targets;
    const tags = [...(getAllTags(cache) ?? []), ...this.tagAliasesOf(file)];
    for (const tag of tags) {
      for (const candidate of ancestryDeepestFirst(tag)) {
        const notes = (this.conceptNotes.get(candidate) ?? []).filter((note) => note !== file);
        if (notes.length === 0) continue;
        for (const note of notes) targets.set(note.path, note);
        break;
      }
    }
    return targets;
  }

  // Keyed by the file each link resolves to, so a link Obsidian rewrote after a rename still counts as correct.
  storedTargets(file, stored) {
    const targets = new Map();
    for (const value of [stored].flat()) {
      if (typeof value !== "string") continue;
      const linkpath = value.replace(/^\[\[|\]\]$/g, "").split(/[|#]/)[0];
      const resolved = this.app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
      targets.set(resolved ? resolved.path : "unresolved:" + value, resolved);
    }
    return targets;
  }

  async sync(file) {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return false;
    const stored = cache.frontmatter?.[PROPERTY];
    const desired = this.desiredTargets(file);
    if (stored === undefined && desired.size === 0) return false;
    if (stored !== undefined && desired.size > 0 && sameKeys(desired, this.storedTargets(file, stored))) return false;

    const links = [...desired.values()]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((note) => `[[${this.app.metadataCache.fileToLinktext(note, file.path, true)}]]`);
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      if (links.length) frontmatter[PROPERTY] = links;
      else delete frontmatter[PROPERTY];
    });
    return true;
  }

  addPromoteItem(menu, tag) {
    tag = stripHash(tag);
    if (this.menusWithPromote.has(menu) || this.conceptNotes.has(canonical(tag))) return;
    this.menusWithPromote.add(menu);
    menu.addItem((item) =>
      item
        .setTitle(`Promote #${tag}`)
        .setIcon("arrow-up-circle")
        .onClick(() => new PromoteModal(this, tag).open())
    );
  }

  async promote(tag, choice) {
    const file = choice === CREATE_NEW ? await this.createConceptNote(tag) : choice;
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      const aliases = parseFrontMatterAliases(frontmatter) ?? [];
      if (!aliases.some((alias) => isTagAlias(alias) && canonical(alias) === canonical(tag))) aliases.push("#" + tag);
      frontmatter.aliases = aliases;
      delete frontmatter.alias;
    });
    new Notice(`Promoted #${tag} to ${file.basename}`);
  }

  async demote(file) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      const aliases = (parseFrontMatterAliases(frontmatter) ?? []).filter((alias) => !isTagAlias(alias));
      if (aliases.length) frontmatter.aliases = aliases;
      else delete frontmatter.aliases;
      delete frontmatter.alias;
    });
    new Notice(`Demoted ${file.basename}`);
  }

  conceptNoteName(tag) {
    return tag.split("/").join(" ");
  }

  async createConceptNote(tag) {
    const name = this.conceptNoteName(tag);
    const existing = this.app.metadataCache.getFirstLinkpathDest(name, "");
    if (existing) return existing;
    const folder = this.app.fileManager.getNewFileParent("");
    return this.app.vault.create(normalizePath(`${folder.path}/${name}.md`), "");
  }
};

class PromoteModal extends FuzzySuggestModal {
  constructor(plugin, tag) {
    super(plugin.app);
    this.plugin = plugin;
    this.tag = tag;
    this.setPlaceholder(`Concept note for #${tag}`);
  }

  getItems() {
    const notes = this.app.vault.getMarkdownFiles().filter((file) => !this.plugin.isExcluded(file));
    const nameTaken = this.app.metadataCache.getFirstLinkpathDest(this.plugin.conceptNoteName(this.tag), "");
    return nameTaken ? notes : [CREATE_NEW, ...notes];
  }

  getItemText(item) {
    return item === CREATE_NEW ? `Create "${this.plugin.conceptNoteName(this.tag)}"` : item.path;
  }

  onChooseItem(item) {
    this.plugin.promote(this.tag, item);
  }
}

class UnifiedTagLinksSettings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Excluded folders")
      .setDesc("One folder per line. Notes here get no tag_links and cannot be concept notes.")
      .addTextArea((text) =>
        text.setValue(this.plugin.settings.excludedFolders.join("\n")).onChange(async (value) => {
          this.plugin.settings.excludedFolders = value.split("\n").map((line) => line.trim()).filter(Boolean);
          await this.plugin.saveData(this.plugin.settings);
          if (this.plugin.ready) this.plugin.scheduleFullSync();
        })
      );
  }
}
