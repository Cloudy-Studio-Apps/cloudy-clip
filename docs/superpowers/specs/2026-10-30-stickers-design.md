# Stickers

A Stickers tab in the spirit of CapCut: the user browses packs, drops a sticker on the timeline, and
moves it on the video like any clip. Stickers are static or animated, come in packs, and other
plugins can add more packs.

## Why

Short-form editing leans on stickers: emoji reactions, arrows, mascots. The prototype
(`docs/prototype/index.html`, the `stickers` tab) already promises the tab, and `docs/modules.md`
already uses a sticker as its example of a plugin's element. Stickers are also the first real test
of "plugins come later, but the API is designed now": a third-party pack must be able to do exactly
what a built-in pack does.

## Goals

- A Stickers tab that stays easy to understand with thousands of stickers.
- Packs as the unit of organization, with topics that cut across packs.
- Static and animated stickers in one grid.
- Optional variations on a sticker (skin tone, color, style), changeable after it is on the timeline.
- A public way for another module or plugin to contribute packs, topics and stickers, and to add a
  style to a pack that already exists.
- Stickers that help editing, not only decoration: arrows, circles, speech bubbles.
- A small app: only the light art ships by default, and heavy art comes as plugins.
- Everything works offline, and an agent can do all of it.

## Non-goals

- An online catalog, store or download step. "Installed" means every pack the app knows about right
  now; there is no "available to install" state.
- GIF, WebP or APNG stickers. Animated stickers are Lottie only in this version.
- The user's own custom stickers (Canvas has these; Clip does not get them here).
- Plugin loading itself. Packs contribute through a point, which a future plugin host will use.
- The Fluent Color and 3D styles and the Noto animated emoji. They are future plugins (see below),
  and this work only makes sure the API can carry them.
- Keyframes, animation in/out or per-sticker effects. The prototype's sticker "Animation" inspector
  section is out of scope.
- Export. The app has none yet; stickers only need to draw in the preview and in `captureAt`.

## Anti-goals

- Every emoji shown twice because styles became separate packs or tiles.
- A tab that dumps thousands of tiles and hitches when opened.
- Built-in packs using anything a plugin pack couldn't.
- Shipping art with an unclear license. Microsoft Teams' animated Fluent emojis are out for this
  reason: the community copy has no clear license.

## What the user sees

The look is in the mockups from the design conversation. Options A and B were rejected; the chosen
layout is below. Everything uses the kit and semantic tokens (rules 33–35).

**Normal view.** A list button and a search box in one row. Under them, **Recently used** (one row
of tiles) and **Packs** (two columns of covers: a 2×2 of the pack's stickers, its name, its count).

**Drawer.** The list button opens a drawer that slides over the panel, inside the panel, with a dim
behind it. It has two sections: **Topics** (All, then each topic) and **Installed** (every pack,
built-in or contributed, with its count). Picking an item closes the drawer.

**Grid view.** Picking a pack cover, a topic or a drawer item shows that pack or topic as a full
four-column grid with a back control and its title. A topic pulls stickers from every pack. Search
replaces the content with results across all packs, by label and keywords.

**Tiles.** Hover shows the sticker's label. Animated stickers carry a small ▶ mark. Click adds at the
playhead; drag drops on the timeline, like the Text tab.

**On the timeline.** A sticker sits on a video track and takes the transform tools. Its inspector
shows its variations when it has any. An animated sticker loops for the clip's length and is frozen
on the correct frame when paused or scrubbed.

## Packs and art

These three packs ship by default:

| Pack         | Stickers                                                | Variations   | Source and license                                                     |
| ------------ | ------------------------------------------------------- | ------------ | ---------------------------------------------------------------------- |
| Cloudy Seal  | 15 seal moods from Canvas, static                       | None         | `cloudy-canvas`, `src/shared/core/stickers/catalog/seal/`, same author |
| Cloudy Seal  | 5 animated seals                                        | None         | `cloudy-canvas`, `src/shared/ui/brand/*-seal.tsx`, same author         |
| Editing      | Arrows, circles, bubbles (see below)                    | Color        | Drawn for this app, same license as the app                            |
| Fluent Emoji | 169 emoji, Smileys & Emotion group, Flat style (0.4 MB) | None for now | `microsoft/fluentui-emoji`, MIT, Microsoft                             |

**Cloudy Seal** comes first in the panel, then Editing, then Fluent Emoji.

**Animated seals** are hopping, celebrating, patting, painting and adrift. They are SVG with CSS
today, which the preview can't seek, so they are re-made as Lottie, marked ▶. They are the only
animated stickers that ship by default, and they prove the Lottie path for plugins. The
`seals-hopping.mp4` video in Canvas is not a source for them.

**Editing** is new art, drawn as plain SVG in the app's look, for pointing things out on video:

- Arrows: straight, curved, hand-drawn, double-headed.
- Marks: circle, hand-drawn circle, box, underline, cross, check, spark, burst.
- Bubbles: speech, rounded speech, thought, shout. They are empty, so a text clip sits on top.

Each has a Color variation with a small set (white, black, red, yellow, blue, green), so it reads on
any footage. Shapes are square-ish tiles, with `aspect` where they aren't.

### Future plugins

Fluent Color (132 MB raw, about 20 MB compressed), Fluent 3D (110 MB, 256×256 PNG, soft when
enlarged) and Noto's 881 animated emoji (roughly 30 MB, license to be confirmed from a Google source)
are **not** built here. There is no plugin loader yet, so they can't be optional today, and anything
bundled now would be in everybody's app.

What is built is the way in. Color and 3D must not become separate packs (that repeats every emoji),
so a plugin can add a **style** to an existing pack (see the second point below). The Fluent pack
declares a `style` axis with Flat as its only option. With one option the inspector hides the axis;
when a plugin adds Color, the choice appears on every Fluent sticker. Noto is a plain pack with
Lottie art, which `stickerPacks` already carries.

### Credits

MIT needs its notice kept. The Fluent pack's folder carries Microsoft's license text, the pack
declares a credit line, and `README.md` gets a "Third-party content" section like Canvas's. A
pack's credit shows in the app at the top of its grid view.

## How it is built

### Module

A new `feature` module `sticker` in `src/modules/sticker/`, with the required files, listed in
`bootstrap.ts`. It requires `project`, `element`, `preview`, `timeline`, `transform` and
`inspector`, as text does, and contributes a `side` panel titled "Stickers".

The built-in packs are contributed by this module through the same point a plugin uses (rule 8), and
never through a private path.

### The contribution point

`stickerPacks` lives in `sticker.points.ts`, keyed by pack `id`, like `transitionPresets`. A pack
declares:

- `id`, `name`, `order`, `credit?`, `cover?` (sticker ids; the first four by default).
- `topics?`: new topics this pack introduces (`id`, `label`). Topics are merged across packs by
  `id`, so packs can share them. Built-in topic ids are exported so a plugin can tag stickers with
  them.
- `variations?`: named axes the pack's stickers may use (`id`, `label`, `options`, a `default`).
- `stickers`: an array, or an async loader for large packs, so a big pack's list isn't in the main
  bundle.

A sticker declares `id` (unique in the pack), `label`, `keywords?`, `topics?`, `aspect?` (width over
height, square by default, because `picture.size` is synchronous and can't wait for the art),
`variations?` (the axes and options it really has) and its art: a function from the chosen variation to `{ type: "image" |
"lottie", url }`. Static art is an SVG or a PNG, animated art is a Lottie JSON file. A plain list of
pictures with no topics or variations must work, so the simple pack is the shortest one to write.

A second point, `stickerStyles`, adds a style to a pack another module owns. An entry names the
`pack`, the `axis`, the new option (`id`, `label`) and its own art function from sticker and
variation to art. The panel and the inspector merge those options into the axis. If the module is
removed, a clip using that option falls back to the axis's default and keeps its place.

The types and `defineStickerPack` are exported from `index.ts` with TSDoc: this is the future plugin
API (rule 31).

### The sticker element

One element, `kind: "sticker"`, `source: "none"`, `tracks: ["video"]`, supporting `transform`,
`picture.fit: "none"`, `display` with its own icon and `clip-type` color. Props: `pack`, `sticker`,
and one value per variation axis.

Only those references go in the document. The art stays in the pack, so a project doesn't grow with
its stickers. A clip whose pack or sticker is missing (a plugin was removed) keeps its place and
draws a placeholder, and the project is otherwise unharmed. `project_get_state` shows the references
(rule 19).

The inspector's variation controls come from the element system. The field list depends on the
sticker, so it needs a custom prop type and control in the module (as `transition-options` does),
written through `element.setProps`, so changing a variation is one undo step and keeps transform and
timing. A new sticker lasts 3 s, the default of `timeline.addElement`.

### Drawing and time

Two things are missing from `picture` today, and both are additions to `element` and `preview`, for
any element to use:

1. **Time.** `DrawEnv` has no time. It gains the time inside the clip, so an animated picture can
   compute its frame. The engine already has `time` where it draws.
2. **Readiness.** Rule 22 says the engine paints only when every visible layer has its frame.
   Sticker art loads asynchronously. `picture` gains an optional way to say a clip isn't ready, and
   the engine treats it like an unready video frame, including `captureAt`, where an unready frame
   is an error and never a stale picture. When art finishes loading the module asks for a redraw
   (`preview.redraw`), as fonts do.

The engine stays free of sticker knowledge (rule 23). Everything sticker-specific is in `draw`.

Decoded art is cached per art URL and raster size, with a size limit and disposal through
`ctx.onDispose`. SVGs are rasterized once at the size they're shown at and again only when that
size grows, because some art is large (a plugin's Color SVG reaches 560 KB of paths) and can't be parsed each
frame. A
sticker's picture is never drawn with React on the per-frame path (rule 24).

**Lottie** is played with `lottie-web` (MIT) in its canvas renderer, by seeking to an exact frame
(`goToAndStop(frame, true)`) from the clip's time, looped by the animation's duration. It never runs
on its own clock, which would break scrubbing, pausing and `captureAt`. One player per art file is
enough, since each draw seeks it first. This is the one new dependency.

The frame comes from the time since the clip started. Clips without a file keep `sourceIn` at 0, so
the right half of a split sticker starts its loop again. That is accepted for this version.

The element's `draw` must also work inside junction mixing, where clips are drawn into offscreen
canvases, and in `captureAt`'s detached engine.

### Art in the app

Only Fluent's **Smileys & Emotion** group ships for now: 169 emoji, 169 Flat SVGs, 0.38 MB. This keeps
the app small and the feature easy to test. The art is committed, so the app works straight from a
clone.

- A script (`scripts/stickers.*`) reads `microsoft/fluentui-emoji` at a pinned commit, keeps the groups
  it is told to (one line to widen later), copies the Flat SVGs and generates the pack's sticker list
  from `metadata.json` (names, keywords). Its output is committed; it runs only when updating the set.
- The Fluent pack still uses the async list loader, so that path is tested by a built-in pack.
- This group has no skin tones. Tones aren't built or shown for now, and the Editing pack's Color
  variation is what tests variations. A pack can still declare a `tone` axis later.
- Art loads per tile, only when visible. Grids stay virtualized: the built-in packs are small, but a
  plugin's may not be.
- Topics: Smileys and Reactions (seal moods and emoji), Arrows, Marks, Bubbles.
- Seal art is copied into `src/modules/sticker/`. Canvas builds it from parts in code, so the ported
  form is whichever is simpler: the same parts, or generated SVG files.

### Recently used

Across all projects, kept per user, never in the document or history (rule 16). A stable small list
(12 is enough). Recording a recent is not a project change. Recent entries whose pack is gone are
hidden.

### Commands and MCP

Adding a sticker is one new command, `sticker.add` (`pack`, `sticker`, variation values, optional
`start`, `trackId`), with the tool `sticker_add`. It loads the pack's list, refuses an unknown pack,
sticker or variation with `CommandFailure("sticker.…")`, then adds the clip the way
`timeline.addElement` does, in one undo step. `timeline.addElement` alone can't do this, because its
validation is synchronous and a pack's list may not be loaded. The tiles and the agent both use
`sticker.add`. Changing a variation is `element.setProps`, with the same check in the sticker's prop
type where the list is loaded.

A sticker's natural size in output pixels is a fixed share of the frame's short side, so it looks
the same in any format.

`sticker.mcp.ts` adds read tools so an agent can find stickers:

- `sticker_list_packs`: packs, counts, topics.
- `sticker_search`: by text, topic or pack, with a `limit`; returns the ids and variations to pass to
  `sticker_add`.

## Constraints

Rules in `CLAUDE.md` apply, especially 7–13 (modules and points), 14–17 (commands and state), 22–24
(frames and per-frame paths), 26–30 (virtualization, file shape) and 33–35 (UI). The spec for what
counts as a test is rule 3: the element's references and any `picture`/`DrawEnv` change to the
kernel of drawing earn tests; the panel does not.

Another session is working in `src/core/` and `src/modules/project/` on collaboration mode. Stay out
of those files where possible.

## Decisions made by the user

- The tab layout (Option C plus the drawer, with Topics and Installed).
- Stickers are independent, with optional variations per sticker. Variations are chosen per clip,
  not per pack.
- Default packs: Fluent Emoji in Flat, only the Smileys & Emotion group, Canvas's seal pack, and useful arrows and bubbles.
- Fluent Color and 3D come as plugins, not by default.
- Animated stickers are in scope, and they exist as animated seals by default.

## Calls made in the design, for review

- Lottie as the only animated format, played with `lottie-web`.
- Noto's animated emoji also move to a future plugin, like Color and 3D.
- Nothing heavy is built now, since without a plugin loader it couldn't be optional.
- `stickerStyles`, so a plugin can add a style to Fluent without duplicating it.
- The Editing pack's list and its six colors.
- Pack order: Seal, Editing, Fluent.
- Animated stickers loop for the clip's length.
- GIFs aren't accepted.
- A split animated sticker restarts its loop on the right half.
- Adding goes through a new `sticker.add`, so stickers are checked before they're added.
- Recently used lasts across projects.
- Flat art is committed, since it is small.
- Skin tones wait until a group that has them is added.
- Clips hold references to art, not a copy of it, so a removed plugin leaves a placeholder.

## Left to the builder

- Where persisted recents live (the app has no settings store yet).
- The exact shape of readiness on `picture`.
- How `create.gesture` is shared so sticker tiles drag like `CreateTiles` (export what's needed from
  `timeline`).
- How the art folder reaches the app (Vite public folder or Tauri resources), and which is lighter
  on Windows and WebKitGTK.
- The Lottie authoring route for the five seals.
- The list of topics, from Fluent's groups.
