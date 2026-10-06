import type { TFile } from "obsidian";

export interface Settings {
  excludedFolders: string[];
}

export function isInFolders(file: TFile, folders: readonly string[]): boolean {
  return folders.some((folder) => {
    const prefix = folder.replace(/\/+$/, "");
    return prefix !== "" && (file.path === prefix || file.path.startsWith(prefix + "/"));
  });
}
