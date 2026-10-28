<div align="center">

# Unified Tag Links

[![Obsidian downloads](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json&query=%24%5B%22unified-tag-links%22%5D.downloads&label=downloads&logo=obsidian&color=7C3AED)](https://obsidian.md/plugins?id=unified-tag-links)
[![Release](https://img.shields.io/github/v/release/TheBoyRoy05/Obsidian-Unified-Tag-Links?label=release)](https://github.com/TheBoyRoy05/Obsidian-Unified-Tag-Links/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/TheBoyRoy05/Obsidian-Unified-Tag-Links/ci.yml?branch=main&label=CI)](https://github.com/TheBoyRoy05/Obsidian-Unified-Tag-Links/actions/workflows/ci.yml)

<a href="https://buymeacoffee.com/issacroy"><img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coconut&emoji=%F0%9F%A5%A5&slug=issacroy&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" alt="Buy me a coconut" height="40"></a>

</div>

To answer the age-old question of tags vs notes, why not both? An [Obsidian](https://obsidian.md/) plugin that links tags to notes. Tags by default, then "Promote" to a note when you actually have something to write about without losing the hierarchy of tags.

Suppose I have an `#Obsidian` tag and an `[[Obsidian]]` note. The benefit of the tag is that I can refer to subtags, e.g. `#Obsidian/Graph`, without having to refer to a dead / empty note, e.g. `[[Obsidian Graph]]`. The benefit of the note is that it's linkable and you can visualize the connections through the graph view.

What if I want the best of both worlds? What if I want to see every referral to the concept of Obsidian, which spans the note, the tag, and the subtags. This plugin solves the syncing between notes and tags.

Simply refer to the tag or subtag, e.g. `#Obsidian/Graph`, and the plugin will automatically add the relevant note, e.g. `[[Obsidian]]`, to a `tag_links` property in the frontmatter, which handles the note linking.

## How it works

- **Concept notes.** A note becomes the concept note for a tag when it lists the tag in its aliases, e.g. `aliases: ["#Obsidian"]`.
- **Managed links.** Each tagged note gets a `tag_links` property holding links to the matching concept notes, automatically created, managed, and deleted by the plugin as needed.
- **Nested tags.** Matching is case-insensitive and includes subtags. `#Obsidian/Graph` links to the `#Obsidian` concept note, unless `Obsidian/Graph` has a concept note of its own.
- **Excluded tags.** A concept note can refuse tags by listing them in `tag_links_exclude`. An entry matches that exact tag; end it with `/*` to match every subtag under it instead.

### Example

Two concept notes:

```yaml
# Obsidian.md
---
aliases:
  - "#Obsidian"
tag_links_exclude:
  - "#Obsidian/Plugin/*"
---
```

```yaml
# Canvas.md
---
aliases:
  - "#Obsidian/Canvas"
---
```

What the plugin writes to `tag_links` on each note:

| Note | `tag_links` | Why |
| --- | --- | --- |
| Tagged `#Obsidian` | `[[Obsidian]]` | Exact match |
| Tagged `#obsidian/graph` | `[[Obsidian]]` | Subtag, case-insensitive |
| Tagged `#Obsidian/Canvas/Board` | `[[Canvas]]` | Deepest concept note wins |
| `Canvas.md` | `[[Obsidian]]` | A concept note links to its parent's |
| Tagged `#Obsidian/Plugin` | `[[Obsidian]]` | `/*` matches only subtags |
| Tagged `#Obsidian/Plugin/Dataview` | none | Excluded by `#Obsidian/Plugin/*` |
| Tagged `#Daily` | none | No concept note |

To refuse `#Obsidian/Plugin` itself as well, also list `"#Obsidian/Plugin"`.

A refused tag falls back to the next parent's concept note. If `Obsidian Plugin.md` had the alias `#Obsidian/Plugin` and excluded `"#Obsidian/Plugin/Dataview"`, a note tagged `#Obsidian/Plugin/Dataview` would still link to `[[Obsidian]]`.

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

## Vault access

The plugin reads every Markdown note in the vault to find tags and concept notes. It writes only the `tag_links` property, the `aliases` property when you promote or demote, and the new note when Promote creates one. It makes no network requests.

## Installation

In **Settings -> Community plugins**, select **Browse**, search for **Unified Tag Links**, then select **Install** and **Enable**.

Requires Obsidian 1.4.4 or later. Works on desktop and mobile.

## Development

Clone into `.obsidian/plugins/unified-tag-links/` of a test vault, then run `npm install` and `npm run dev` to rebuild `main.js` on every save. `npm test` runs the test suite.
