import { describe, expect, it } from "vitest";
import type { App, TFile } from "obsidian";
import { ConceptIndex } from "../src/concept-index";
import { LinkSync, TAG_LINKS_PROPERTY } from "../src/link-sync";
import { isInFolders } from "../src/settings";
import { ancestryDeepestFirst, tagAt } from "../src/tags";
import { MockVault } from "./obsidian-stub";

function setup(excludedFolders: string[] = []) {
  const vault = new MockVault();
  const isExcluded = (file: TFile) => isInFolders(file, excludedFolders);
  const app = vault.app as unknown as App;
  const index = new ConceptIndex(app, isExcluded);
  const linkSync = new LinkSync(app, index, isExcluded);
  const syncAll = async () => {
    index.rebuild();
    for (const file of app.vault.getMarkdownFiles()) await linkSync.sync(file);
  };
  return { vault, syncAll };
}

describe("tagAt", () => {
  it("finds the tag under the cursor, including nested segments", () => {
    expect(tagAt("see #Obsidian/Graph here", 8)).toBe("Obsidian/Graph");
  });

  it("ignores headings in links and all-digit tags", () => {
    expect(tagAt("[[Note#Heading]]", 8)).toBeNull();
    expect(tagAt("issue #123", 8)).toBeNull();
  });

  it("matches a tag at the start of a line", () => {
    expect(tagAt("#Obsidian", 0)).toBe("Obsidian");
  });
});

describe("ancestryDeepestFirst", () => {
  it("lists the tag and each parent, lowercased", () => {
    expect(ancestryDeepestFirst("#Obsidian/Graph")).toEqual(["obsidian/graph", "obsidian"]);
  });

  it("treats the leading hash as optional, since tag aliases arrive already stripped", () => {
    expect(ancestryDeepestFirst("Obsidian/Graph")).toEqual(ancestryDeepestFirst("#Obsidian/Graph"));
  });
});

describe("LinkSync", () => {
  it("links a child tag to its parent's concept note, case-insensitively", async () => {
    const { vault, syncAll } = setup();
    vault.add("Obsidian.md", { aliases: ["#Obsidian"] });
    const daily = vault.add("Daily.md", {}, ["#obsidian/Graph"]);
    await syncAll();
    expect(vault.frontmatter(daily)[TAG_LINKS_PROPERTY]).toEqual(["[[Obsidian]]"]);
  });

  it("links only the deepest promoted match", async () => {
    const { vault, syncAll } = setup();
    vault.add("Obsidian.md", { aliases: ["#Obsidian"] });
    vault.add("Obsidian Graph.md", { aliases: ["#Obsidian/Graph"] });
    const daily = vault.add("Daily.md", {}, ["#Obsidian/Graph"]);
    await syncAll();
    expect(vault.frontmatter(daily)[TAG_LINKS_PROPERTY]).toEqual(["[[Obsidian Graph]]"]);
  });

  it("links a child concept note to its parent but never to itself", async () => {
    const { vault, syncAll } = setup();
    const parent = vault.add("Obsidian.md", { aliases: ["#Obsidian"] });
    const child = vault.add("Obsidian Graph.md", { aliases: ["#Obsidian/Graph"] });
    await syncAll();
    expect(vault.frontmatter(child)[TAG_LINKS_PROPERTY]).toEqual(["[[Obsidian]]"]);
    expect(vault.frontmatter(parent)[TAG_LINKS_PROPERTY]).toBeUndefined();
  });

  it("leaves excluded folders and unpromoted tags untouched", async () => {
    const { vault, syncAll } = setup(["Templates"]);
    vault.add("Obsidian.md", { aliases: ["#Obsidian"] });
    const template = vault.add("Templates/Daily.md", {}, ["#Obsidian"]);
    const other = vault.add("Other.md", {}, ["#Docker"]);
    await syncAll();
    expect(vault.frontmatter(template)[TAG_LINKS_PROPERTY]).toBeUndefined();
    expect(vault.frontmatter(other)[TAG_LINKS_PROPERTY]).toBeUndefined();
  });

  it("writes nothing on a second sync", async () => {
    const { vault, syncAll } = setup();
    vault.add("Obsidian.md", { aliases: ["#Obsidian"] });
    vault.add("Daily.md", {}, ["#Obsidian"]);
    await syncAll();
    const writes = vault.writes;
    await syncAll();
    expect(vault.writes).toBe(writes);
  });

  it("removes the property when the tag goes", async () => {
    const { vault, syncAll } = setup();
    vault.add("Obsidian.md", { aliases: ["#Obsidian"] });
    const daily = vault.add("Daily.md", {}, ["#Obsidian"]);
    await syncAll();
    vault.files.get(daily.path)!.inlineTags = [];
    await syncAll();
    expect(vault.frontmatter(daily)[TAG_LINKS_PROPERTY]).toBeUndefined();
  });

  it("falls back to the parent when a child concept note is demoted", async () => {
    const { vault, syncAll } = setup();
    vault.add("Obsidian.md", { aliases: ["#Obsidian"] });
    const child = vault.add("Obsidian Graph.md", { aliases: ["#Obsidian/Graph"] });
    const daily = vault.add("Daily.md", {}, ["#Obsidian/Graph"]);
    await syncAll();
    delete vault.frontmatter(child).aliases;
    await syncAll();
    expect(vault.frontmatter(daily)[TAG_LINKS_PROPERTY]).toEqual(["[[Obsidian]]"]);
  });

  it("strips stale links from a note moved into an excluded folder", async () => {
    const { vault, syncAll } = setup(["Templates"]);
    vault.add("Obsidian.md", { aliases: ["#Obsidian"] });
    const template = vault.add("Templates/Daily.md", { [TAG_LINKS_PROPERTY]: ["[[Obsidian]]"] }, ["#Obsidian"]);
    await syncAll();
    expect(vault.frontmatter(template)[TAG_LINKS_PROPERTY]).toBeUndefined();
  });
});
