# Unified Tag Links

An [Obsidian](https://obsidian.md/) plugin that links tags to notes. 

Suppose I have an `#Obsidian` tag and an `[[Obsidian]]` note. The benefit of the tag is that I can refer to subtags, e.g. `#Obsidian/Graph`, without having to refer to a dead / empty note, e.g. `[[Obsidian Graph]]`. The benefit of the note is that it's linkable and you can visualize the connections through the graph view.

What if I want the best of both worlds? What if I want to see every referral to the concept of Obsidian, which spans the note, the tag, and the subtags. This plugin solves the syncing between notes and tags.

Simply refer to the tag or subtag, e.g. `#Obsidian/Graph`, and the plugin will automatically add the relevant note, e.g. `[[Obsidian]]`, to a `tag_links` property in the frontmatter, which handles the note linking.

## How it works

- **Concept notes.** A note becomes the concept note for a tag when it lists the tag in its aliases, e.g. `aliases: ["#Obsidian"]`.
- **Managed links.** Each tagged note gets a `tag_links` property holding links to the matching concept notes, automatically created, managed, and deleted by the plugin as needed.
- **Nested tags.** Matching is case-insensitive and includes subtags. `#Obsidian/Graph` links to the `#Obsidian` concept note, unless `Obsidian/Graph` has a concept note of its own.

## Usage

- **Promote a tag:** right-click a tag in the editor and choose **Promote**. Pick an existing note, or create one named after the tag (`Obsidian/Graph` becomes `Obsidian Graph`). The plugin adds the tag alias and links every note carrying the tag.
- **Demote a concept note:** open the note and run **Demote this concept note** from the command palette. The tag alias is removed and the links disappear; the note itself is kept.
- **Resync:** run **Resync all notes** to rebuild every `tag_links` property. A full resync also runs on startup.

Changes are written about 2 seconds after you stop editing, so a tag is not linked while you are still typing it.

| Event | Result |
| --- | --- |
| Add or remove a tag | The note's `tag_links` is updated. |
| Delete a concept note | Links to it are removed. |
| Rename a concept note | Obsidian updates the links; the plugin leaves them alone. |
| Rename a tag with [Tag Wrangler](https://github.com/pjeby/tag-wrangler) | The tags and the tag alias change together, so links keep working. |

## Settings

- **Excluded folders:** one folder per line. Notes in these folders get no `tag_links` and cannot be concept notes. For example, exclude your templates folder so template tags do not create links.

## Tag Wrangler support

[Tag Wrangler](https://github.com/pjeby/tag-wrangler) is optional, but recommended. When it is installed:

- **Promote** also appears when you right-click a tag in the tag pane.
- Renaming a tag also renames the matching tag alias, so concept notes follow the rename.

Without Tag Wrangler, Promote is available from the editor menu only, and a renamed tag needs its alias updated by hand.

## Installation

The plugin is not in the community plugin directory. To install it manually:

1. From your vault folder, run 
```sh
git clone git@github.com:TheBoyRoy05/Obsidian-Unified-Tag-Links.git .obsidian/plugins/unified-tag-links/
```
2. In Obsidian, open **Settings -> Community plugins** and enable **Unified Tag Links**.

Requires Obsidian 1.4.4 or later. Works on desktop and mobile. There is no build step: `main.js` is the plugin.
