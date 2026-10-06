import { PluginSettingTab, Setting } from "obsidian";
import type UnifiedTagLinks from "../main";

export class SettingsTab extends PluginSettingTab {
  constructor(private readonly plugin: UnifiedTagLinks) {
    super(plugin.app, plugin);
  }

  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Excluded folders")
      .setDesc("One folder per line. Notes here get no tag_links and cannot be concept notes.")
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
