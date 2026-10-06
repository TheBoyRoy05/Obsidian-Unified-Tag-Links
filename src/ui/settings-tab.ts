import { PluginSettingTab, Setting, type SettingDefinitionItem } from "obsidian";
import type UnifiedTagLinks from "../main";

const EXCLUDED_FOLDERS_NAME = "Excluded folders";
const EXCLUDED_FOLDERS_DESC = "One folder per line. Notes here get no tag_links and cannot be concept notes.";

export class SettingsTab extends PluginSettingTab {
  constructor(private readonly plugin: UnifiedTagLinks) {
    super(plugin.app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: EXCLUDED_FOLDERS_NAME,
        desc: EXCLUDED_FOLDERS_DESC,
        render: (setting) => this.renderExcludedFolders(setting),
      },
    ];
  }

  // Obsidian before 1.13 ignores getSettingDefinitions and renders through display.
  display(): void {
    this.containerEl.empty();
    this.renderExcludedFolders(new Setting(this.containerEl));
  }

  private renderExcludedFolders(setting: Setting): void {
    setting
      .setName(EXCLUDED_FOLDERS_NAME)
      .setDesc(EXCLUDED_FOLDERS_DESC)
      .addTextArea((text) =>
        text.setValue(this.plugin.settings.excludedFolders.join("\n")).onChange(async (value) => {
          this.plugin.settings.excludedFolders = value
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          await this.plugin.saveData(this.plugin.settings);
          if (this.plugin.ready) this.plugin.scheduleFullSync();
        })
      );
  }
}
