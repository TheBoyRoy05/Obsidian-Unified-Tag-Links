import { FuzzySuggestModal, type TFile } from "obsidian";
import type UnifiedTagLinks from "../main";

export const CREATE_NEW = Symbol("create-new");
export type PromoteChoice = TFile | typeof CREATE_NEW;

export class PromoteModal extends FuzzySuggestModal<PromoteChoice> {
  constructor(
    private readonly plugin: UnifiedTagLinks,
    private readonly tag: string
  ) {
    super(plugin.app);
    this.setPlaceholder(`Concept note for #${tag}`);
  }

  getItems(): PromoteChoice[] {
    const notes = this.app.vault.getMarkdownFiles().filter((file) => !this.plugin.isExcluded(file));
    const nameTaken = this.app.metadataCache.getFirstLinkpathDest(this.plugin.conceptNoteName(this.tag), "");
    return nameTaken ? notes : [CREATE_NEW, ...notes];
  }

  getItemText(item: PromoteChoice): string {
    return item === CREATE_NEW ? `Create "${this.plugin.conceptNoteName(this.tag)}"` : item.path;
  }

  onChooseItem(item: PromoteChoice): void {
    void this.plugin.promote(this.tag, item);
  }
}
