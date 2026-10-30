# Compositions

A project holds compositions, the way an After Effects project does. A composition is the settings
(size, frame rate, background, length) plus its own tracks and clips; the timeline is the window
that shows one of them. Compositions live next to imported files in a Library tab, and dragging one
onto a timeline places it as a clip that mirrors the original.

## Why

Today a project has one flat timeline and one `format`, changed only by three fixed presets under
the preview. That is not enough for a professional editor: there is no custom size or frame rate,
no background, no way to reuse a piece of a video, and the size sits one click away from an accident.

The product stays easy for a CapCut user and deep for an After Effects user. A beginner drags a clip
onto an empty timeline and starts cutting, without ever hearing the word "composition". An advanced
user makes compositions on purpose, sets them up, and nests them.

## Goals

- A project starts with no composition. Dragging from the Library onto the empty timeline creates
  one that matches the item; New Composition creates one from a dialog.
- Composition Settings: name, presets, custom width and height, frame rate, background colour,
  duration, Extend to fit.
- Several compositions in a project, each with its own tracks and clips, one marked Main.
- A Library tab holding compositions and files, from which either is dragged onto a timeline.
- Placing a composition inside another. Every placement is a live mirror of the one original.
- Everything is a command: undoable, and available to agents.

## Non-goals

- Pages or a workspace switcher. The layout stays as it is (the user decided this, against a
  Resolve-style Media page).
- Export, saving and loading. Compositions are built so both fit later (see Later).
- Folders, search and a details view in the Library.
- Keyframes, speed changes, or time remapping of a placement.
- Per-placement overrides of what is inside a composition.

## Anti-goals

- The size or frame rate changing without the user asking. After this work they change only
  through Composition Settings, or at the one moment a composition is created from a dropped item.
- A beginner having to understand compositions before their first cut.
- Two ways of editing: inside a composition, every tool works exactly as on any timeline.
- A composition containing itself, directly or through another.

## Decisions the user made

| Decision            | Choice                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Timeline vs comp    | The timeline is a window on one composition. There is no separate timeline object.                |
| Where they live     | In the Library, next to files, dragged from there.                                                |
| Layout              | No pages. The rail's Media tab stays where it is and becomes Library.                             |
| Editing a nested    | One master. Every placement mirrors it, like a clone.                                             |
| Starting            | No composition at first. Drag creates one at the item's size, or New Composition opens the dialog |
| Dialog              | Presets, size, background colour and the rest, like After Effects.                                |
| Length              | Fixed, with an Extend to fit option in the settings.                                              |
| Library tab content | Compositions above, files below. Small tabs above the timeline switch between open compositions.  |

## Behaviour

### Starting

The first run shows an empty timeline and an empty preview with one message: drag something here, or
New Composition.

- **Dropping a video file** creates a composition named after the file, at the file's picture size
  and frame rate, with the file's length, Extend to fit on, one video track and one audio track. The
  file lands at time 0. The whole gesture is one undo step.
- **Dropping something with no picture size** (audio, text, a sticker) opens the New Composition
  dialog; the item lands when the dialog is confirmed. Cancelling drops nothing. Clicking a Text or
  Sticker tile with no composition does the same.
- **Dragging a composition** onto a timeline with nothing open just opens it.
- **Compositions exist but none is open** (all tabs closed): a dropped item opens Main and lands in
  it. This never adds a composition to the Library.
- A file whose frame rate is unknown (FFmpeg is missing) gets 30 fps.

**Files still being read.** Settings need only size, frame rate and length, which `ffprobe` reports
at the start of import, before any proxy is encoded, so a camera file does not hold the drop for
minutes. The drop waits outside the command (the bus is serialized, a command must not wait): a small
"Reading file" chip stays on the timeline until the metadata arrives, then the command runs. A second
drop replaces a waiting one, Escape cancels it, and a file that can't be read reports through
`notify`. `composition_create_from_media` does not wait: it refuses with `media.not_ready`.

The library drags one item at a time. Dropping several at once is Later;
`composition.createFromMedia` takes a list so that needs no new command, using the first item with
a picture for the settings.

The first composition created in a project becomes Main.

### Open composition

Each actor (the user, each agent) has one open composition.

- It starts as Main, or none when the project has no composition. An agent joining opens Main.
- Creating a composition opens it for its creator. If the user has nothing open and an agent creates
  a composition, the user's view opens it too, so they see the work.
- If an actor's open composition is deleted or undone away, it falls back to Main, then to none.
- Commands that need a composition and don't name a clip or track use the open one:
  `timeline.addTrack`, `timeline.addClip` and `timeline.addElement` without a track,
  `timeline.split` without clips, `preview.play`, `preview.seek`, `preview_capture_frame`.
- With none open they refuse with `composition.none_open`, and the message says to call
  `composition_create` or `composition_create_from_media`. The MCP instructions in
  `src-tauri/src/mcp` say so too: an agent on an empty project imports, then creates.

### New Composition and Composition Settings

The same dialog, opened from the Library header (New) or by right-clicking a composition, or a
button in the Project view of the inspector (Settings).

| Field         | Notes                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Name          |                                                                                                      |
| Preset        | 9:16, 16:9, 1:1, 4:5, 4K 16:9, 4K 9:16, Custom. Fills size and frame rate; editing a field is Custom |
| Width, height | Integers, 2 to 8192, with a lock for the ratio                                                       |
| Frame rate    | 23.976, 24, 25, 29.97, 30, 50, 59.94, 60, or typed                                                   |
| Background    | Colour, default black                                                                                |
| Duration      | Timecode, default 10 s                                                                               |
| Extend to fit | Checkbox, default off in the dialog                                                                  |
| Resize        | Settings only, when the size changed: Keep positions (default) or Scale content to the new frame     |

The 9:16, 1:1 and 16:9 buttons under the preview are removed, so nothing there can change the size.

**Resize.** Keep positions leaves every clip's transform alone, as After Effects does; clips stay
centred relative to the frame. Scale content keeps each clip in the same proportion of the frame:
`x` is multiplied by the width ratio and `y` by the height ratio. A `contain` picture keeps its
`scale`, because `clipPlacement` already refits it to the new frame; a `fit: "none"` picture (text,
stickers) multiplies `scale` by the smaller of the two ratios. Both choices are one undo step.

### Length

- `duration` is what the composition plays. The playhead stops there.
- Clips may sit past the end. They are dimmed after an end marker and do not play.
- The end marker is draggable (one undo step, on release).
- With **Extend to fit** on, the duration follows the end of the last clip, up and down. A
  composition with no clips is one frame long. Dragging the end marker turns the option off.
- An **Extend to fit** action in the timeline's right-click menu does a one-time fit.

### The Library

The rail's `media.library` panel is renamed Library. Compositions come first, as tiles with a
thumbnail, name, size and length, Main with a star; files follow as today. Text, Transitions and
Stickers stay as they are.

- **Click** selects it, and the inspector shows its settings summary.
- **Double-click** opens it: the timeline and preview switch to it and it gets a tab.
- **Drag** places it on the timeline. Dragging a composition onto its own timeline, or onto one it
  is inside, is refused with a message saying why.
- **Right-click:** Open, Composition Settings, Set as Main, Duplicate, Delete.
- Each tile shows how many times it is placed.

A composition in use cannot be deleted, as with files. Main cannot be deleted while other
compositions exist; move the star first. Deleting the only composition returns the project to the
empty start.

### Timeline tabs

A strip above the timeline shows the open compositions. Click to switch, a small cross to close a tab
(this hides it, nothing is lost). Each composition remembers its own playhead, zoom and scroll. The
selection clears on switching. All of this is view state, never undoable.

With nothing open, the empty message returns, and the Library still lists the compositions.

### Placing a composition

Placing creates a clip of the new `composition` element on a video track, plus a linked sound clip
on an audio track, as a video file does. The sound clip is created even if the composition is silent
today: placements are live, so music added inside later must be heard in every placement.

**Shared from the original:** everything inside, including clips, text, timing and inner transitions.

**Kept by each placement:** position, size, rotation, trim, track and transitions at its cuts.

A placed composition is drawn at its own size, fitted to the frame like a video (`contain`), and
then its transform applies.

Empty areas of a nested composition are see-through. The background colour shows only when the
composition is the one open, and later when it is exported. A logo composition over a video works
with no extra setting.

Double-clicking a placed clip opens the original in a tab.

**Length changes.** A longer original leaves placements as they are; they can be trimmed out to the
new length. A shorter one shortens every placement that would pass its end, within the same undo
step. If that breaks a transition on the placement's right cut, the transition goes and the
placement ends at the next clip's start, so no overlap is left behind and nothing to the right moves.

**Cycles.** Placing is refused when the target composition is the same one, or is inside the one
being placed at any depth (`composition.cycle`).

### Make unique

Right-click a placement, Make unique. The composition is duplicated (with its tracks, clips and
junctions; compositions nested in it stay shared), the copy is named "Intro copy", and that one
placement now points to it. The others keep following the original.

### Group into composition

Right-click selected clips, Group into composition. A new composition is created at the size and
frame rate of the current one, with Extend to fit off and a length equal to the selection's span.
The clips move inside on matching tracks, with times rebased so the earliest starts at 0. A placement
takes their place from the earliest start to the latest end, on the topmost selected video track,
with its sound on the topmost selected audio track, creating whichever track is missing (an
audio-only selection still gets both clips, as every placement does). Linked partners come along. A
clip with a junction to a clip outside the selection loses that junction. If the span would overlap
an unselected clip on those tracks, the command refuses with `composition.group_blocked` and changes
nothing. One undo step.

### Agents

Agents can do all of the above. As with the playhead, each agent has its own open composition and
never moves the user's, with the one exception under Open composition. `project_get_state` lists
every composition with its settings and tracks. Collab shows an agent
working in another composition by pointing at its tab, or the Library tile if it isn't open. Follow
also follows the agent into the composition it has open.

## Data

Tracks, clips and junctions stay in the flat records of `ProjectState`, with project-wide unique
ids. A track belongs to a composition. This is the important choice in this design: everything that
works from a clip or track id, including undo's field-by-field diff and the `repair`/`validate`
policy, keeps working untouched. Only the code that walks a whole timeline or reads `format` changes
(about 19 and 28 files today, most by one line).

```ts
export type CompositionId = string;

export interface Composition {
  id: CompositionId;
  name: string;
  /** Output size and frame rate, the old `ProjectState.format`. */
  format: ProjectFormat;
  /** CSS colour shown behind the clips when this composition is the output. */
  background: string;
  /** What it plays. Kept up to date while `extendToFit` is on. */
  duration: Micros;
  extendToFit: boolean;
  /** Top to bottom, the old `ProjectState.trackOrder`. */
  trackOrder: TrackId[];
}

export interface ProjectState {
  compositions: Record<CompositionId, Composition>;
  /** Order in the Library. */
  compositionOrder: CompositionId[];
  /** Opens first and is exported later. Null only when there are no compositions. */
  mainCompositionId: CompositionId | null;
  media: Record<MediaId, MediaAsset>;
  mediaOrder: MediaId[];
  tracks: Record<TrackId, Track>;
  clips: Record<ClipId, Clip>;
  junctions: Record<JunctionId, Junction>;
}

// Track gains
compositionId: CompositionId;
// Clip gains: the composition it plays (composition clips)
compositionRef?: CompositionId;
```

`format` and `trackOrder` leave `ProjectState`. `createEmptyProject()` returns no composition and no
tracks. `sourceIn` of a composition clip is a time inside the composition. `ProjectFormat.fps` stays
a number; 29.97 is stored as 30000/1001.

New `project` selectors: `compositionOf(state, track)`, `formatOf(state, clip)`,
`orderedTracks(state, compositionId)`, `compositionContent(state, compositionId)` (the end of the
last clip), `placementsOf(state, compositionId)`, `sourceDuration(...)` (the length a clip's source
allows, from the probe or the composition), and the pure cycle check `contains(state, outer, inner)`.
`projectDuration` goes.

### The settle step (kernel change)

Extend to fit and shortening placements must hold after every change, from any command, and undo
must revert them with the change that caused them. `ctx.mutate` has no place for that today.

`StorePolicy` gains an optional `settle(draft)`. `store.produce` runs it after the recipe, inside the
same `produceWithPatches`, so its writes are part of the step; `writeFields` runs it next to `repair`.

`projectPolicy.settle` walks compositions innermost first: it sets `duration` where Extend to fit is
on, then shortens each placement that would run past its source, moving `sourceIn` back when it
would otherwise be past the end. When a junction no longer fits, it removes the junction and ends
the left clip (and its linked sound) at the right clip's start, so `allowedOverlap` holds. It never
moves a clip's `start` and never reads a junction kind's limits, so it stays inside `project` and
can't fail.

`diff` does not report `duration` of a composition with Extend to fit on: it is derived, and two
collaborators editing clips in one composition must not conflict over it on undo.

`validate` adds: a track without its composition, a clip naming a missing composition, a cycle, a
missing Main.

Rule 15 still holds: a command validates what it asks for before writing. `settle` only keeps
derived consequences true.

## Modules

A new core module, **`composition`**, above `timeline`, `preview` and `media` so it can contribute to
all three: `requires` `project`, `element`, `media`, `timeline`, `preview`. It owns its commands,
tools, the dialog, the Library section and the tabs (rules 8 and 10).

| Module                                        | Change                                                                                                                                                                                                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project`                                     | The data, selectors and policy above. API gains `view`: a per-kernel, non-undoable store of each actor's open composition and open tabs (`openFor(actor)`), so lower modules can read it. `project.setFormat` and `project_set_format` go. `formatPreset` and `FORMAT_PRESETS` move to `composition`. |
| `composition`                                 | New. `composition` element (`source: "composition"`, `tracks: ["video", "audio"]`, supports `transform`), the commands below, dialog, tabs, tile, tool list.                                                                                                                                          |
| `element`                                     | `ElementDefinition.source` gains `"composition"`; picture size comes from the composition it plays.                                                                                                                                                                                                   |
| `media`                                       | Panel title Library. New point `librarySections` (`composition` contributes its section above the files). `startMediaDrag` becomes a drag of a typed item (`{ type, id }`); `MEDIA_DROP` carries it. Probe gains `fps`.                                                                               |
| `timeline`                                    | Reads the open composition. New points: `timelineTabs` for the strip, `timelineDropHandlers` for typed items and for drops with no composition. End marker, dimmed area past the end. Trim limit uses `sourceDuration`. Exports what `composition.place` needs for placement.                         |
| `preview`                                     | Renders the open composition, per actor; `captureAt` too; stops at `duration`. Drawing below. `FormatPicker` goes. Background colour replaces the black fill.                                                                                                                                         |
| `inspector`                                   | Project view shows the open composition and a Composition Settings button.                                                                                                                                                                                                                            |
| `collab`                                      | `locate` learns `composition:` targets; Follow also opens the agent's composition.                                                                                                                                                                                                                    |
| `transform`, `text`, `transition`, `junction` | Read the format through `formatOf` / the open composition. Otherwise unchanged.                                                                                                                                                                                                                       |
| `src-tauri/src/media`                         | `ffprobe` also reports width, height, frame rate and length, sent early in `media://proxy` with `hasAudio`, and the probe fills from them so a drop need not wait for the proxy. `PROXY_RECIPE` does not change.                                                                                      |

| Command                          | MCP tool                        | Notes                                                      |
| -------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| `composition.create`             | `composition_create`            | Undoable. Creates the two tracks; first one becomes Main   |
| `composition.createFromMedia`    | `composition_create_from_media` | Undoable. One step for the drop on an empty timeline       |
| `composition.setSettings`        | `composition_set_settings`      | Undoable. Includes `resize: "keep" \| "scale"`             |
| `composition.setMain`            | `composition_set_main`          | Undoable                                                   |
| `composition.duplicate`          | `composition_duplicate`         | Undoable. Inner compositions stay shared                   |
| `composition.delete`             | `composition_delete`            | Undoable. Refuses `composition.in_use`, `composition.main` |
| `composition.place`              | `composition_place`             | Undoable. Refuses `composition.cycle`                      |
| `composition.makeUnique`         | `composition_make_unique`       | Undoable                                                   |
| `composition.group`              | `composition_group`             | Undoable                                                   |
| `composition.extendToFit`        | `composition_extend_to_fit`     | Undoable. One-time fit                                     |
| `composition.open` / `.closeTab` | `composition_open`              | Not undoable. For the agent, sets its own open composition |

`docs/modules.md`, `CLAUDE.md` (the v1 scope, the module list, rule 13's points) and each changed
README are updated with the code.

### Drawing

`render` stops walking one flat timeline. A pure `logic/frame.ts` resolves a composition at a time
into a tree of active tracks, descending into composition clips with their local time
(`clip.sourceIn + time - clip.start`). That is where the test goes.

- **Pictures.** A composition clip is drawn by rendering its composition into a transparent offscreen
  canvas, then placing that canvas like a video frame, with `clipPlacement` and the clip's transform.
  Each nesting depth takes one pooled canvas per clip being drawn; the mix path for junctions works
  unchanged because `drawClip` still draws one clip onto a target. The transform of inner clips comes
  from the document only: live gesture overrides apply to the open composition.
- **Slots.** One original can be on screen twice at different times, so an inner clip's id no longer
  identifies a media element. Slots, `needed`, `presented` and junction state key on the path of
  placements down to the clip (`outerClip/innerClip`), never the bare clip id. The pool's reuse
  across splits still applies within one path.
- **Readiness.** Rule 22 still holds: the engine paints only when every visible layer at every depth
  has its frame.
- **Sound.** A sound clip of a composition resolves to the inner sound clips active at its local
  time, with inner mute and inner crossfades, multiplied by its own gain. Hidden inner tracks stay
  hidden; a muted outer track silences the whole placement.
- **Frame rates.** Nothing is resampled. An inner composition is shown at whatever instant the outer
  clock asks for.
- **Limits.** Decoding is the cost of nesting: a placement of a composition with four videos needs
  four elements. Above a limit the engine logs and draws what it can, and tells the user once through
  `notify`. Depth has no limit of its own beyond that. A render cache is Later.

## What's left to the builder

- Whether `settle` needs a dirty check; a gesture is one command, so a full walk may be fine.
- Library tile thumbnails. `captureAt` can make them, debounced; an icon with the size is an
  acceptable first version.
- Colour and look of a composition clip on the timeline (a new `clip-composition` token), and its body
  (no filmstrip or waveform in the first version).
- How long tab strips scroll.
- Limit value for concurrent decoders.
- Exact right-click menu host: there is no shared context menu in `@/ui` today, and one belongs there.

## Build order

1. **Foundation.** The data move, `settle`, selectors, `composition` module with create, settings,
   set Main, delete, duplicate, the dialog, the Library, tabs, empty states, per-actor open
   composition, background colour, end marker, Extend to fit. The app is fully usable at this point
   with several separate compositions.
2. **The automatic start.** Frame rate from `ffprobe`, `composition.createFromMedia`, the drop cases.
3. **Nesting.** The `composition` element, frame resolving, offscreen drawing, path keys, sound,
   placing, cycles, shortening placements, double-click to open.
4. **Advanced.** Make unique, Group into composition, Resize with Scale content.

Tests follow rule 3: `settle`, undo through it, cycles, frame resolving, and the junction and
placement rules on a project with several compositions. Fixtures in existing tests move to a helper
that seeds one composition.

## Later

In the order I would take them:

1. **Save and load.** Compositions are lost when the app closes, like everything today. This matters
   more with each feature, and the file format should be written after step 1 so it is born with
   compositions in it.
2. **Export of Main**, or of any composition.
3. **Resize for another format:** duplicate a 9:16 composition as 16:9, reframed, keeping clips shared
   where possible.
4. **Library folders, search, a details view, and selecting several items** to drag together.
5. **Templates:** save a composition to reuse across projects.
6. **A render cache** for nested compositions.
