# Junctions and transitions

Status: agreed with the user on 2026-10-29 (brainstorm). Calls marked **(my call)** were made by
Claude during the brainstorm and are open to the user's correction; everything else is the user's.

## Why

Cloudy Clip needs transitions between clips, CapCut style: pick a pre-made one, drop it on the cut
between two clips, done. While designing it we found a more general idea underneath: **something
that sits on the cut between two clips and keeps them connected**. Transitions are the first kind
of it; a plugin should be able to declare other kinds (a whoosh sound on a cut, a flash frame, a
beat marker) through the same surface, without depending on the transitions feature.

## The idea in one paragraph

A **junction** sits on the cut between two clips that touch on the same track. It is drawn on the
timeline as a **glass chip with its name** straddling the join, and it keeps the two clips
connected: it moves with them and disappears in the same edit that separates them. A **junction
kind** is declared once (name, icon, values, whether it overlaps the clips, how it draws). The
`transition` feature contributes one junction kind (`transition`) whose `preset` value picks from a
catalog of **pre-made, silent** transitions. A transition **overlaps** the two clips: the right
clip and everything after it on that track slide earlier by the transition's duration, so both
clips really play during it and the video gets shorter.

## Goals

- Pre-made transitions between two touching clips on a picture track, applied from a new
  **Transitions** tab, shown as a glass chip on the cut, undoable, and fully drivable by agents.
- A generic, plugin-ready **junction** concept with fixed rules that every kind follows.
- A preview hook that mixes two clips' pictures, built so that effects and adjustment layers can
  reuse it later.

## Non-goals (for this project)

- An effects system, adjustment layers, keyframes. They are a separate, later project; the mixing
  hook and preset declarations are shaped so they can reuse them (see "Later").
- Sound in transitions. CapCut's transitions are picture only; users add whoosh sounds themselves.
  A sound-on-a-cut junction kind may come later.
- Junctions on audio tracks as a user-facing thing; audio follows its linked picture (below).
- Export (not in v1 at all).
- A GPU renderer.

## Anti-goals (would make it a failure even if it "works")

- Transition logic leaking into `timeline`, `preview` or `project` (no `kind === "transition"`
  outside the `transition` module), or junction rules that each kind reimplements.
- A plugin needing the `transition` feature to declare its own junction kind.
- Clips silently overlapping where no junction says so, or a junction left pointing at clips that
  no longer touch.
- The preview flashing black or stuttering during a transition (rule 21 still holds: paint only
  when every needed frame is ready).
- Per-frame React state in the chip or the preview mixing (rule 23).

## Settled calls

### Junctions (the general concept)

1. **What it is.** A junction joins a **left** clip and a **right** clip that are adjacent on the
   same track. Shape **(my call)**:
   `Junction { id, kind, trackId, leftClipId, rightClipId, duration: Micros, props }`.
   `duration` is 0 for kinds that don't overlap. `props` holds only values that differ from the
   kind's defaults, like `clip.props`.
2. **Fixed rules, the same for every kind** (plugins can't change them):
   - At most one junction per cut. It sits only between two clips that touch (or overlap by
     exactly its `duration`).
   - It moves with its clips. Any edit that separates them (moving either clip away, deleting
     one, moving one to another track) removes the junction **in the same command** and says so in
     the command's result. The clips stay where the edit put them (no shift back).
   - It is drawn as the glass chip on the join, with the kind's icon and name (for transitions,
     the preset's name).
3. **What a kind declares** (`defineJunctionKind`, contributed to a `junctionKinds` point):
   `kind`, `name`, `icon`, `properties` (the same `prop.*` builders and `propTypes` as elements,
   so the inspector can generate its panel and `junction_describe` can describe it), an
   **overlap rule** (`overlap: false`, or `overlap: { default, min, max(leftClip, rightClip) }`),
   an optional `mix` (how it draws, below), optional `display(props)` (the chip's label).
4. **Where it lives** **(my call; the builder may refine the exact split if the dependency graph
   argues otherwise, keeping the anti-goals)**:
   - **Data** in the project document: `ProjectState.junctions: Record<JunctionId, Junction>`,
     typed in `project`, so undo and `project_get_state` work with no extra wiring.
   - **Pure rules** in `project` logic (`logic/junctions.ts`): which overlaps are allowed, pruning
     junctions whose clips no longer touch, the overlap shift. The timeline's link helpers
     (`partnersOf`, `withPartners`) move from `timeline/logic/links.ts` to `project` so these rules
     can follow linked clips; `timeline` re-uses them from there.
   - **A new core module `junction`** (requires `project`, `element`): the `junctionKinds` point,
     the generic commands, `junction_*` MCP tools, the registry (like `ElementApi`: `get`, `list`,
     `resolve(junction)`).
   - **`timeline`** (requires `junction`): draws the chips, keeps junctions valid in every clip
     command (via the `project` rules), selects junctions, and exposes `cutTarget(clientX,
clientY)` (the cut under a screen point, for drops from the tab) next to `dropTarget`.
   - **`preview`** (requires `junction`): the mixing hook (below).
5. **Generic commands** (owned by `junction`): `junction.add` (`kind`, `leftClipId`,
   `rightClipId` or `at` + `trackId` to pick the cut, optional `props`, optional `duration`),
   `junction.set` (`junctionIds`, `patch`, optional `duration`), `junction.remove` (`junctionIds`).
   MCP: `junction_add`, `junction_set`, `junction_remove`, `junction_describe` (every kind, its
   schema and defaults). Junctions appear in `project_get_state`.

### Timing: the overlap (CapCut style)

6. **Adding an overlapping junction** of duration `d` between A (left) and B (right): B and
   **every clip after it on the same track** move `d` earlier, and so do their **linked partners**
   (a video's sound). Clips on other tracks that aren't linked stay put **(my call)**. If the move
   would make any clip overlap something that no junction covers, the command fails and nothing
   changes (`junction.overlap`), with a message naming the clip in the way.
7. **Linked sound under the cut** **(my call)**: when A and B both have linked sound clips that
   are adjacent on an audio track, they overlap by the same `d` and the preview crossfades their
   volumes over the overlap. This is covered by the same junction (the audio pair counts as
   covered); no separate audio junction is created.
8. **Changing the duration** shifts by the difference; **removing** shifts back by `d`. Both
   follow rule 6 (same track + partners; fail cleanly on a collision).
9. **Limits:** default duration **0.5 s**; maximum **half the shorter of the two clips**
   (CapCut's rule as reported by third-party guides; not officially confirmed); minimum one frame.
   A request outside the limits is clamped for a drag, refused for a command
   (`junction.invalid_duration`, with the allowed range in the message).
10. **Edits to joined clips** **(my call)**:
    - **Trimming a joined edge** (A's end or B's start) keeps the junction: B and what follows on
      the track (plus partners) shift by the trim's change so the overlap stays `d`; if a clip gets
      too short for `d`, `d` shrinks to the new maximum in the same command.
    - **Splitting** A before the overlap moves the junction to A's right half; splitting B after
      the overlap keeps it on B's left half; **splitting inside the overlap is refused**
      (`junction.split_in_overlap`).
    - **Moving or deleting** a joined clip removes the junction (rule 2), no shift back.
    - **Moving a joined clip** (drag or `timeline.moveClip`) **(my call)**: moving A and B
      together (same delta, same track) keeps the junction. Moving one of them so they still
      overlap keeps the junction with its duration following the new overlap, if that is within
      the kind's limits; outside the limits the move is refused (`junction.invalid_duration`).
      Moving it so they touch exactly removes an overlapping junction (duration would be 0);
      moving it apart removes the junction. No shift back in either case.
11. **Who enforces what** **(my call)**: `project` rules are structural only (the two clips are
    adjacent on one track and overlap by exactly `duration`; pruning). The kind's limits
    (`max(left, right)`, minimum one frame) are applied by the commands that change clip lengths
    or junctions (`timeline` clip commands and `junction` commands), which can see the registry.
    Clip lengths in µs don't change with the format, so a format change touches no junction. A
    junction whose kind isn't registered (plugin not loaded) is **kept**: its chip shows the
    kind's id with a "not available" note, it draws no `mix`, and it is logged once, like a missing
    element.
12. **Track invariant** changes from "clips never overlap" to "clips never overlap **except by
    exactly the duration of a junction joining them** (or of the pair linked to that junction,
    rule 7)". Every timeline guard (`findOverlap`, trim limits, snapping, drop targets, moves) goes
    through the `project` rule, never its own check.
13. **Which clips can be joined** **(my call)**: any two clips on a video track whose elements
    have a `picture` (media, text, a plugin's), so a transition works text → text and text →
    video too. A kind declares the track kinds it may sit on (`tracks: ["video"]`); `transition`
    is video only. The generic `junction.add` allows a plugin kind on audio tracks if it declares
    them (e.g. a future sound-on-cut kind).

### Preview: the mixing hook

14. A junction kind's optional `mix(ctx, a, b, progress, props, env)` draws the junction's frame.
    `a` and `b` are the two clips' pictures already drawn (placement, transform; a media frame or
    the element's own `draw`) onto full-frame offscreen canvases (default accelerated 2D canvases:
    never `willReadFrequently`, which draws video black on WebKitGTK); `progress` goes 0 → 1 over the overlap; `env` gives the format, scale,
    and a seeded random for noise. The engine composites the result in the track's place in the
    layer order. A kind without `mix` draws nothing extra (the right clip simply covers the left).
15. The engine **paints only when both clips' frames are ready** (rule 21). Two clips of the same
    file (a split with a transition between its halves) need **two media elements at once** during
    the overlap. The slot pool assigns a slot per clip id (`MediaSlotPool.assigned`; "reused across
    clips" means a _free_ warm element on the same file is picked), so two active clips already
    get two elements; the builder must check that the right clip is preloaded (seeked and its
    frame presented) before the overlap starts, and that the seamless-split path still works when
    there is no junction.
16. **Built for later reuse:** the hook is the place where effects and adjustment layers will plug
    in (one input instead of two). Nothing in it is transition-specific.

### The transition feature

15. **New feature module `transition`** (requires `project`, `element`, `junction`, `preview`,
    `timeline`, `inspector` as it actually uses them). It contributes the junction kind
    `transition` (overlaps; values: `preset`, plus per-preset values such as direction or
    softness), the preset catalog, the **Transitions** tab (side panel, a lucide icon), and its MCP
    tools: `transition_list_presets` and `transition_apply` (`commandTool` over a
    `transition.apply` command that picks the cut and runs `junction.add`/`junction.set` nested,
    one undo step).
16. **Presets are declarations** (`defineTransitionPreset`: `id`, `name`, `category`,
    `thumbnail` (a small animated preview drawn by the preset itself), `properties`,
    `mix`). Plugins add presets the same way; the kind's `mix` dispatches to the preset's.
    **Preset values** **(my call)**: the `transition` kind's own properties stay fixed: `preset`
    (a string checked against the registered presets) and `options` (a `custom` prop type,
    `transition-options`, whose schema, defaults and control come from the chosen preset's
    `properties`). So `defineJunctionKind` stays static for plugins; `junction.set` validates
    `options` against the current (or newly set) preset; `junction_describe` lists each preset's
    options schema. **Swapping the preset drops the old preset's options** (keeps the duration).
17. **First catalog**, grouped like CapCut's library:

    | Category | Preset                 | Look                                                              |
    | -------- | ---------------------- | ----------------------------------------------------------------- |
    | Basic    | Fade                   | A fades to black, B fades in from black                           |
    | Basic    | Cross dissolve         | A blends smoothly into B                                          |
    | Basic    | Dissolve **(my call)** | Grainy: B appears in random specks/blocks                         |
    | Basic    | Left to right          | Smooth soft-edged wipe (direction value; push as a later variant) |
    | Overlay  | Glare                  | A bright flash/light sweep hides the cut                          |
    | Blur     | Woosh **(my call)**    | A fast blurred swipe (whip pan), picture only, no sound           |
    | Glitch   | Glitch                 | Shifted slices and a red/blue split                               |

    More presets later through the same declarations.

18. **Applying** **(my call)**: drag a preset from the tab onto a cut (the cut under the pointer
    highlights; dropping elsewhere does nothing), or click a preset to apply it to the selected
    cut/junction, or to the cut at the end of the selected clip. Applying onto a cut that already
    has a transition replaces its preset (keeps the duration).
19. **The chip** (timeline): glass look (translucent, blurred backdrop, light border, sharp ≤ 8px
    corners, tokens only), icon + name, width = duration at the current zoom (a minimum width so
    0.1 s stays clickable). Click selects it (the inspector shows its panel: preset, duration,
    preset values, remove); dragging its edges changes the duration with DOM feedback and one
    command on release (rule 23); Delete removes it.

## File tree

Expected layout, following `docs/modules.md`. `+` new, `~` changed, `→` moved. The builder may
split a file further (rule 26) or rename within the conventions; the module boundaries and what
each module owns are the design.

### New core module `junction`

```
src/modules/junction/                      + tier core, requires project, element
  index.ts                                 + public API: defineJunctionKind, junctionKinds, junctionRef,
                                             types, guards other modules need
  junction.ref.ts                          + junctionRef = defineModuleRef<JunctionApi>("junction")
  junction.module.ts                       + wiring: registry, commands, MCP tools
  junction.types.ts                        + JunctionKindDefinition, OverlapRule, MixFn, MixEnv,
                                             ResolvedJunctionKind, JunctionApi
  junction.points.ts                       + junctionKinds (keyed by kind); read by the registry
  junction.registry.ts                     + JunctionApi: get(kind), list(), resolve(junction), warn()
  junction.commands.ts                     + junction.add / junction.set / junction.remove, the list
  junction.guards.ts                       + requireJunction, requireCut, checkDuration (limits)
  junction.mcp.ts                          + junction_add, junction_set, junction_remove, junction_describe
  logic/
    limits.ts                              + duration limits of a kind for two clips (default, min, max)
    cut.ts                                 + find the cut at a time on a track; left/right clips
  README.md                                +
  *.test.ts                                + next to each of the above with logic
```

### New feature module `transition`

```
src/modules/transition/                    + tier feature, requires project, element, junction,
                                             preview, timeline, inspector (as actually used)
  index.ts                                 + defineTransitionPreset, transitionPresets, transitionRef, types
  transition.ref.ts                        +
  transition.module.ts                     + contributes the kind, presets, options prop type, tab
  transition.types.ts                      + TransitionPresetDefinition, TransitionProps, TransitionApi
  transition.points.ts                     + transitionPresets (keyed by id); read by the kind and the tab
  transition.kind.ts                       + the `transition` junction kind (overlap, preset, options,
                                             mix dispatching to the preset)
  transition.options.ts                    + the `transition-options` custom prop type
  transition.apply.command.ts              + transition.apply (picks the cut, nested junction.add/set)
  transition.commands.ts                   + the list
  transition.mcp.ts                        + transition_apply, transition_list_presets
  presets/                                 + one file per built-in preset, a `presets.ts` listing them
    fade.ts  crossDissolve.ts  dissolve.ts  wipe.ts  glare.ts  woosh.ts  glitch.ts
  logic/
    easing.ts                              + easing curves
    noise.ts                               + seeded noise/block masks (dissolve, glitch)
  ui/
    index.ts                               + what the module contributes
    TransitionsPanel.tsx                   + the Transitions tab (categories, preset grid)
    PresetTile.tsx                         + one preset: thumbnail, name; click or drag
    PresetThumbnail.tsx                    + animated preview drawn with the preset's own mix
    preset.gesture.ts                      + drag a preset onto a cut (DOM ghost, cut highlight)
  README.md                                +
  *.test.ts                                + presets' pure parts, apply command, options validation
```

### Changes to existing modules

```
src/modules/project/                       (core)
  project.types.ts                         ~ Junction, JunctionId; ProjectState.junctions
  project.store.ts                         ~ empty `junctions` in a new project
  index.ts                                 ~ export the new types and logic
  logic/                                   + (new folder)
    junctions.ts                           + allowed overlaps, pruning, overlap shift (track + partners)
    links.ts                               → from timeline/logic/links.ts (partnersOf, withPartners)
  README.md                                ~

src/modules/timeline/                      (core, now also requires junction)
  timeline.module.ts                       ~ requires junction
  timeline.types.ts                        ~ selection gains junctions; TimelineApi.cutTarget
  timeline.guards.ts                       ~ overlap checks go through project's junction rules
  timeline.clip.commands.ts                ~ move/trim/split/delete keep junctions valid (rules 2, 10, 11)
  timeline.store.ts                        ~ junction selection
  logic/links.ts                           → moved to project (imports updated)
  logic/trim.ts, placement.ts, drop.ts     ~ limits and snapping aware of junction overlaps
  logic/cut.ts                             + the cut under a screen point (for cutTarget)
  ui/TrackLane.tsx                         ~ draws the lane's junction chips (page-virtualized)
  ui/JunctionChip.tsx                      + the glass chip
  ui/junction.gesture.ts                   + edge drag = duration (DOM feedback, one command)
  index.ts, README.md                      ~

src/modules/preview/                       (core, now also requires junction)
  preview.module.ts                        ~ requires junction; passes the registry to the engine
  engine/engine.types.ts                   ~ EngineOptions gains the junction registry
  engine/engine.html.ts                    ~ overlapping clips per track; mix at the junction
  engine/engine.mix.ts                     + offscreen canvases (pooled), drawing a and b, calling mix
  engine/engine.slots.ts                   ~ (if needed) preload the right clip before the overlap
  engine/engine.audio.ts                   + volume crossfade of linked sound under a junction
  README.md                                ~

src/modules/inspector/                     (feature, now also requires junction)
  inspector.module.ts                      ~ requires junction
  ui/InspectorPanel.tsx                    ~ a selected junction shows JunctionView
  ui/JunctionView.tsx                      + kind header, duration, generated panel, remove
  README.md                                ~

src/app/bootstrap.ts                       ~ lists junctionModule and transitionModule
docs/modules.md                            ~ tier table: junction and transition rows
CLAUDE.md                                  ~ "Where to look": junction/ and transition/
```

`src/core/` (the kernel) is **not** changed: junctions use the existing command bus, points,
patchable store and MCP registry.

## Risk to check first

**Blur and colour split on WebKitGTK.** Woosh and Glitch look best with real blur
(`CanvasRenderingContext2D.filter`) and per-channel shifts. The builder should first spike these on
the Linux webview (support and cost at 1080×1920 while playing). If they fall short, Woosh uses a
smeared multi-draw and Glitch uses offset slices with a colour tint, and the full look waits for
the GPU renderer that effects will bring. Pixel reads (`getImageData`) of video are off the table
(slow; a CPU canvas draws video black on WebKitGTK).

## Left to the builder

- Exact type and file names inside each module, following `docs/modules.md`.
- How `mix` gets offscreen canvases (pooled per engine), easing curves, chip minimum width.
- The tab's layout (it should follow the Text tab and `docs/prototype/`), thumbnails' look.
- Error ids beyond those named here, following `<module>.<reason>`.
- The inspector wiring for a selected junction (generated from the kind's `properties`, reusing
  the element panel machinery where it fits).

## Later (not this project)

- Effects and adjustment layers, reusing the mixing hook (one input) and the preset declaration
  shape; an adjustment layer becomes an element whose drawing runs effects on what's below.
- Sound junction kinds (whoosh on a cut), more transition presets, a GPU renderer.
