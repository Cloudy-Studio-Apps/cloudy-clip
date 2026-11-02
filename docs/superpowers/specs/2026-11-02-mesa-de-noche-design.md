# Mesa de noche: the prototype in the real app

The dark light-table design in `docs/prototype/designs/b-mesa-de-noche.html` becomes the look of Cloudy
Clip. The app should feel like an animator's desk at night: black paper, blue roughs, white pencil, red
corrections, with the foca watona as its mascot. It stays easy, not Resolve-heavy.

The prototype is the visual reference. Open it with a hash to reach a state, for example
`b-mesa-de-noche.html#page:export,insp:audio`. Where this document and the prototype disagree, this
document wins.

## The plans

Each tab is its own plan and can ship on its own once the foundation is in.

| Order | Plan                                       | Covers                                                                                 |
| ----- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| 1     | `plans/2026-11-02-mesa-foundation.md`      | Tokens, fonts, kit, seal, top bar, rail, layout sizes, which page opens                |
| 2     | `plans/2026-11-02-mesa-export-tab.md`      | Export page look; every field already works                                            |
| 3     | `plans/2026-11-02-mesa-sound-tab.md`       | Sound page, where the seal draws itself                                                |
| 4     | `plans/2026-11-02-mesa-media-tab.md`       | Bins, smart bins, disks, solid colors, viewer, file facts, metadata, Edit's bin picker |
| 5     | `plans/2026-11-02-mesa-edit-tab.md`        | Library rail panels, preview, timeline, inspector, File tab. Needs the Media plan      |
| 6     | `plans/2026-11-02-mesa-audio-inspector.md` | The inspector's Audio tab: volume, pan, fades, EQ, pitch, in preview and export        |

Only plans 4 to 6 depend on each other. Clip speed needs its own plan, written after plan 6 (see Audio).

## Decisions

**Tokens.** The Cloudy Dark values in `src/ui/styles/tokens.css` change. Token names stay, so components
follow without edits.

| Token                                             | Value                            |
| ------------------------------------------------- | -------------------------------- |
| `--background`, `--lane`                          | `#14171b`                        |
| `--surface-sunken`, `--stage`                     | `#0e1013`                        |
| `--surface`                                       | `#202327`                        |
| `--muted`, `--hover`, `--popover`                 | `#2a2e33`                        |
| `--border`                                        | `#33383f`                        |
| `--border-strong`                                 | `#4b5a68`                        |
| `--foreground`                                    | `#eceff1`                        |
| `--muted-foreground`                              | `#a9b3bb`                        |
| `--subtle-foreground`                             | `#7b8690`                        |
| `--primary`, `--ring`                             | `#6fb7e6`                        |
| `--primary-hover`                                 | `#8cc7ec`                        |
| `--primary-foreground`                            | `#14171b` (white fails contrast) |
| `--primary-soft`, `--primary-soft-foreground`     | `#263744`, `#bfe0f5`             |
| new `--mark`, `--mark-hover`, `--mark-foreground` | `#ff5f52`, `#ff7a6f`, `#202327`  |
| new `--on`                                        | `var(--primary)`                 |

Nothing in the app switches to `data-theme="light"`, so the Cloudy Light block stays as it is. A light
theme can follow from `b-mesa-de-luz.html` later.

**What red means.** Red is the red pencil: it marks what you touched. That covers the playhead, the
selected clip, active tabs, items used on the timeline, changed values, and the button that starts an
export. Anything that is merely on (switches, EQ dots, bar fills) uses `--on`, which is blue pencil. This
is calmer than the prototype, where switches are red. To go back, set `--on` to `var(--mark)`.

**Fonts.** All three ship offline with Fontsource: `@fontsource-variable/shantell-sans`,
`@fontsource/atkinson-hyperlegible`, `@fontsource/courier-prime`. Shantell Sans is for the wordmark, page
tabs, rail tabs, buttons and section titles. Atkinson Hyperlegible is the body font. Courier Prime is for
timecode and technical values. Inter and JetBrains Mono stay installed because text clips use them as
bundled fonts and as the drawing fallback (`fonts/logic/catalog.ts`, `text.draw.ts`). They stop being UI
fonts.

**Type and shape.** New sizes: `text-md` 14px and `text-display` 19px, the wordmark's size. Radii stay
at 2 to 8px. Round is allowed for avatars, switch thumbs and EQ points only.

**Sizes.** Top bar 48px. Rail 78px with icons above labels. Left column 350px including the rail.
Timeline 300px. The inspector stays at 360px, not the prototype's 290px: the real panels were widened on
purpose and every edge still resizes. Saved sizes keep winning over these defaults.

**Page order and opening.** Media, Edit, Sound, Export. A project opens on Media when it has no clips,
otherwise on Edit.

**Seal.** `SealMark` is redrawn from the prototype's `#seal` symbol: spotted, with dark deadpan open eyes.
The blue construction lines show only at large sizes, through a `rough` prop.

**Documents.** The project format goes to version 2. A version 1 file opens with empty bins and solids.
Old files must never fail to open because of this work.

**Master is not a stored bin.** A file with no `binId` sits in Master. New projects have no bins. The
Footage, Land, Sky and Music tree in the prototype is sample data.

**Solid colors are an element.** A library solid holds name, colour and size. Dropping one on the timeline
makes a clip with its own copy of the colour, editable in the inspector, so deleting the library solid
never breaks a clip. A new solid goes in the open bin, or in Master, and always shows in the Solid colors
smart bin.

**Disks.** Disks list what's mounted. Clicking one opens the file picker there. Browsing folders inside
the app is not part of this.

**Clip metadata belongs to the file.** Camera, reel, scene, shot, take, tag, colour and comments live on
`MediaAsset`, so all clips of a file share them. Timecode and date created are read from the file and are
read-only.

**Compositions stay in the library.** The prototype doesn't show them, but they exist and must keep
working. They get a Compositions smart bin on the Media page and stay as a section at the top of Edit's
Media tab.

**File tab.** The real Timing section stays, below File and Metadata. "Auto-select next unsorted clip"
and "Next clip" only make sense when walking the library, so they appear on the Media page only.

## Audio

The Audio tab goes beyond the v1 scope in `CLAUDE.md` ("no effects, audio mixing"), and the user chose to
include it. `CLAUDE.md` changes when plan 6 lands.

- Preview today sets `element.volume` only. Pan, EQ and pitch need Web Audio on media elements, which has
  not been proven on WebKitGTK, so plan 6 starts with a check that can stop the plan.
- Everything must sound the same in export, so each control has an FFmpeg side.
- Speed change is not in plan 6. `Clip` says "no speed changes in v1", and speed touches placement, trim,
  split, the engine and export, for picture as well as sound. Its section stays out of the Audio tab until
  a separate plan lands. That plan should be written after plan 6 shows what pitch shifting costs.

## Left out on purpose

- Keyframe diamonds on Volume and Pan. The app has no keyframes, and a diamond that does nothing is worse
  than none.
- The AI Dialogue Leveler (no AI in v1).
- Sample content in the prototype: Black solid, sample bins, sample queue jobs.
- The extras discussed around the prototype that were never built in it: status bar, seal logo menu,
  markers, shortcut sheet, step history, meters. They get their own work later.
