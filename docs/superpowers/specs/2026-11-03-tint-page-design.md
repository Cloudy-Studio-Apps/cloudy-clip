# Tint page: design

The Tint page becomes a color room in the spirit of DaVinci Resolve's Color page, for refining a video's
colors so it looks warm, even and professional. Today it is an empty page with the seal.

**Visual reference:** `docs/prototype/designs/tint-d-studio.html` (option D, the one the owner picked). Click
**Mark new tools** at its top right to see the last round of tools. `#leader` opens it in node view,
`#tool=<id>` opens a tool (`basics`, `wheels`, `curves`, `cmix`, `warper`, `creative`, `limit`, `luts`,
`match`, `mixer`), `#wm=zones` opens the zone wheels. Options A, B and C next to it are the road there. The
mockup's picture is a CSS stand-in for a grade and its Detail tab is out of scope (see Non-goals).

## Why

The owner wants to "refine colors like DaVinci Resolve does, so I can edit much more professionally", with
"all the basics and other useful tools a professional will use", while the app stays easy (CapCut, not
Resolve). Two ideas carry the design:

1. **One grade, two ways to see it.** A grade is stored once, as a graph of nodes. **Baby Seal** shows it as a
   list of layers, top to bottom; **Leader Seal** shows it as nodes and wires. A switch in the top bar flips
   between them and changes nothing. The owner chose "professional first": Leader Seal allows free wiring, and
   any part of a graph that has no honest layer shape shows in Baby Seal as a sealed card ("Wired in Leader
   Seal"), whose values stay editable.
2. **Basics first, depth on demand.** The tools open on Basics (exposure, contrast, white balance). Wheels,
   curves, limits and the rest sit one click away in a rail, each explained by its tooltip.

## Goals

- Grade any picture clip with corrections that stack as layers or wire as nodes.
- Everyday tools: Basics, color wheels (primary, log, zones), curves (custom and hue curves), Color mix, Color
  warper, Creative (split toning, faded film, vignette), RGB mixer, highlight rolloff, protect skin.
- Limit a correction to some colors (pick with a dropper) or some brightness. Otherwise it changes the whole
  frame.
- Groups: side by side (parallel), stacked (layer with blend modes), per channel; a correction can reuse
  another one's pick (shared key).
- Camera log footage converts to Rec.709; `.cube` LUTs import; built-in looks and grabbed stills apply.
- Work across shots: copy, paste, paste part of a grade, paste to all, shot groups, a whole-timeline grade,
  versions, match to another shot, match all to this, auto balance, pick white or gray, color chart, skin.
- See the result honestly: parade, waveform, histogram, vectorscope with a skin line, before/after wipe,
  bypass, sample points, false color, clip warning, guides, side by side, a clean full-screen viewer.
- Grade values can be keyed over time (the existing keyframe system).
- What the preview shows is what the export contains.
- Agents can do all of it (rules 14, 18, 19).

## Non-goals

- Drawn shapes, pen cut-outs, gradients as masks, and tracking. The owner: a correction applies "to the
  whole frame or to a specific color". Shapes come later; the data leaves room (a `limit` can grow a `shape`).
- AI masks, relighting, depth, deflicker.
- Picture effects: sharpen, blur, soften skin, noise reduction, film grain. The mockup's Detail tab and its
  Grain slider are not built.
- The "Ask an agent" box (removed by the owner). Agents grade through MCP tools like everything else.
- HDR output, wide-gamut output, ACES-style working spaces and display calibration. Output is Rec.709.
- Grading text, stickers and solids. Only pictures from files and placed compositions are graded.
- Hardware grading panels.

## Anti-goals

- **A control that does nothing.** The mockup is the destination. Each stage ships only working controls; an
  unfinished tool is absent, not disabled.
- **A preview that lies.** A grade looks the same in the viewer, in `preview_capture_frame` and in the export.
  An operation that can't, doesn't ship. An export never silently drops a grade: if it can't apply one, it
  fails and says why.
- **Clutter for simple users.** A clip with no grade shows one empty layer list with `+ Add`, Basics open.
- **Breaking old projects.** Everything new in the document is optional and a value equal to its default is
  never stored. An old file opens and looks the same, and a project that never used Tint saves in the old
  format version.
- **Their names.** No "DaVinci", "Resolve", "Blackmagic", "Fusion", "Fairlight", "Lumetri", "Magic Mask",
  "Color Warper", "Kodak", "Fuji", "X-Rite" or "ColorChecker" anywhere in the UI, presets or tool
  descriptions. Our names are in "Names" below. Camera formats ("Sony S-Log3") are named only to identify a
  footage format.

## Stages

One plan covers all stages, in this order. Each stage ends with the app working and its tools complete.

| Stage | Name              | What ships                                                                                                                                                                 |
| ----- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Check             | WebGL2 on WebKitGTK and WebView2: video upload, float targets, a hidden-window render, speed at 1080p and 4K. Decides the texture format and the fallbacks                 |
| 1     | Grade and page    | The document, the graph, the preview hook, the renderer with Basics and primary wheels, the page in layout D with Baby Seal, clip strip, scopes, bypass, before/after, MCP |
| 2     | Tools             | Curves, Color mix, Warper, Creative, RGB mixer, Log/Bars/Zones wheels, highlight rolloff, protect skin                                                                     |
| 3     | Limits and groups | Limit by color and by brightness, Refine, Show picked, Invert, shared key, side-by-side, stacked and per-channel groups                                                    |
| 4     | Leader Seal       | The node view, free wiring, node positions, sealed cards in Baby Seal                                                                                                      |
| 5     | Color and looks   | Camera color space, `.cube` LUTs, built-in looks, stills (Looks tab)                                                                                                       |
| 6     | Across shots      | Copy/paste/paste part/paste to all, shot groups, whole-timeline grade, versions, Match (auto, white, gray, another shot, all, chart, skin), keyframes on grade values      |
| 7     | Viewer tools      | Sample points, false color, clip warning, guides, side by side, clean viewer                                                                                               |

## The page

Layout D, in the app's own theme (semantic tokens; the mockup is drawn in Cloudy Dark). Panels float on the
table with gutters. Top to bottom:

- **Top bar:** the app's own, plus the **Baby Seal | Leader Seal** switch at the right, contributed to the
  page (not to other pages).
- **Upper row:** the grade panel on the left (Layers or Nodes, and Looks), the viewer on the right. In Leader
  Seal the grade panel widens to about half.
- **Clips bar:** the picture clips of the open composition in time order, with number, name, start, codec and
  frame rate, a "graded" mark, and a timeline overview with the playhead. Its header holds the grade level
  (This clip / Shot group / Whole timeline), Versions, Copy, Paste, Paste part, Paste to all, Match all to
  this and Make shot group.
- **Lower row:** the tools panel (a vertical rail of tool icons, a header naming the open tool and the
  current layer with its keyframe diamond and reset) and the scopes panel (Parade / Waveform / Histogram
  with a vectorscope beside it).

Every icon has a tooltip: bold name, one plain sentence, the shortcut when there is one. Explanations live
in ⓘ icons next to section titles. Number fields scrub when dragged (Shift for fine) and reset on a
double-click of their label; a changed value shows a small dot. These come from `@/ui` (a `Tooltip`,
`InfoTip` and `ScrubField` move there if no kit piece fits, rule 33).

### What is being graded

The **current clip** is the picture clip under the playhead on the topmost visible video track, as in
Resolve. Clicking a clip in the strip makes it current and moves the playhead into it (to the frame last
viewed in it, else its middle). Gradeable clips are media clips with a picture (video, image) and placed
compositions; text, sticker and solid clips are skipped by the strip and by the tools. When the playhead
sits on no gradeable clip the tools show an empty state.

### Playback on this page

The Sound page design (`2026-11-02-sound-page-design.md`, "Playback on this page") needs the same three
changes: a page flag so playback doesn't pause (`keepsPlayback`), plain keys (Space, arrows) working on the
page, and a second `PreviewStage` mounted by the page. Whichever page lands first adds them with those names;
the other reuses them. The Tint page sets `keepsPlayback`. Up/Down jump to the previous/next clip.

## Where things live

This follows the Audio tab and Clip speed: the data sits in `project` because the preview and timeline read
it; the feature owns everything else; the preview gets a generic hook, not grading code.

| Module      | Owns                                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project`   | The grade types and defaults (`ClipGrade`, `GradeNode`, …), `gradeOf`, graph validity (`validateGrade`) in `validate`                                                                                               |
| `preview`   | The `pictureFilters` and `frameFilters` points, live bypass and compare, `onFrame` and `readFrame` for scopes. No color math                                                                                        |
| `tint`      | The page, all `tint.*` commands and `tint_*` tools, the graph logic, the WebGL renderer, scopes, looks, LUT reading, the key target                                                                                 |
| `timeline`  | `splitAt` lists the fields its right half keeps (`timeline.split.commands.ts`), so it gains `grade`, `gradeVersions`, `gradeVersion`, `gradeGroup` and keeps the `grade.*` tracks; paste already clones whole clips |
| `speed`     | Freeze frame bakes values into the hold (`speed.commands.ts`); it keeps the grade and bakes keyed grade values like the others                                                                                      |
| `workspace` | File version 4 when the document holds grade data                                                                                                                                                                   |
| `export`    | Nothing new: it draws through `createRenderer`, which runs the same filters. A filter error fails the export                                                                                                        |

`tint` stays `tier: feature`. It requires `project`, `element`, `preview`, `timeline`, `media`, `keyframe`
(stage 6), `composition` (whole-timeline grade); it lists only what each stage uses.

## The document

All optional. A value equal to its default is never stored, so an untouched clip has no `grade` and draws
exactly as today.

```ts
// project.types.ts (sketch; the builder picks exact names inside these shapes)
interface Clip {
  /** How it's colored. Missing means as the file is. Picture clips only. */
  grade?: ClipGrade;
  /** Other versions of the grade by name; the active one is `grade`. */
  gradeVersions?: Record<string, StoredGradeVersion>; // { grade?, animation? } of that version
  /** Name of the active version. Missing means "A". */
  gradeVersion?: string;
  /** Shot group whose grade runs after this clip's own. */
  gradeGroup?: GradeGroupId;
}
interface Composition {
  /** Whole-timeline grade, applied to this composition's frame (also where it's placed). */
  grade?: ClipGrade;
}
interface ProjectState {
  gradeGroups?: Record<GradeGroupId, { id; name; grade?: ClipGrade }>;
  luts?: Record<LutId, { id; name; path; size: number }>; // files, like media: kept by path
  stills?: Record<StillId, Still>;
  stillOrder?: StillId[]; // Still: { id, name, image (JPEG data URL, ≤ 320 px wide), grade, from: { clipId?, time } }
}

interface ClipGrade {
  /** Camera color space of the source; missing means Rec.709 (no conversion). */
  input?: InputColorSpace;
  /** Every node by id. Keyed paths go through ids: grade.nodes.<id>.values.<field>. */
  nodes: Record<GradeNodeId, GradeNode>;
  /** The node whose picture is the result. */
  out: NodeRef;
}
type NodeRef = { node: GradeNodeId | "source"; channel?: "r" | "g" | "b" }; // channel only after a split
type GradeNode =
  | Correction // { kind: "correct", input: NodeRef, on, opacity, name?, values?, limit?, lut?, pos? }
  | ParallelJoin // { kind: "parallel", inputs: NodeRef[], on, opacity, pos? }
  | LayerJoin // { kind: "layer", inputs: NodeRef[], blends: BlendMode[], on, opacity, pos? }
  | ChannelSplit // { kind: "split", input: NodeRef, pos? }  (outputs r, g, b)
  | ChannelJoin // { kind: "join", r: NodeRef, g: NodeRef, b: NodeRef, pos? }
  | KeyJoin; // { kind: "keyJoin", keys: { from: GradeNodeId, mode: "add" | "subtract" | "intersect" }[], pos? } (Leader Seal only)
```

- `values` holds only fields that differ from `DEFAULT_CORRECTION` (below), each a number or a small object
  of numbers, so every scalar can be a key track. Curves are point arrays and are not keyable.
- `limit`: `{ color?: { on, hue: [a, b], sat: [a, b], lum: [a, b], soft }, brightness?: { on, range: [a, b],
soft }, refine?: { soft, clean }, invert?: true, from?: GradeNodeId | KeyJoin id }`. No `limit` means the
  whole frame. `from` is the shared key: use another correction's pick.
- `lut`: `{ id: LutId | builtin id, strength }`.
- `pos`: a node's place in Leader Seal, in graph units. Missing means auto-layout. Moving nodes is undoable.
- **Validity** (`validateGrade` in `project`): every `tint.*` command checks the graph it would write and
  fails with `tint.invalid_grade` before writing; `projectPolicy.validate` (`logic/fields.ts`) calls it too,
  so an undo reaching past someone else's newer step can't leave a broken graph. The rules:
  every ref exists; no cycles; `out` reachable from `source`; a `channel` ref only from a `split`; a join has
  at least two inputs and `blends` matches `inputs`; a `limit.from` names a correction or key join and makes no
  cycle; values in range. This and the layer conversion are the tests this project keeps (rule 3).
- **Numbers:** layers and nodes are numbered 01, 02, … in stack order (below), not stored.
- **Order of grades on one picture:** source → input conversion → clip grade → shot group grade → output.
  The composition's whole-timeline grade runs on the composed frame. My call: a group grade runs after the
  clip's own, since it carries the shared look.
- **Versions:** switching moves the active `grade` and the clip's `grade.*` key tracks into
  `gradeVersions[old]` and brings the chosen one out, in one undoable step. A new version copies the current.

### Correction values (`DEFAULT_CORRECTION`)

| Group     | Fields (default)                                                                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basics    | exposure 0 (stops, −4…4), contrast 1 (0…2), pivot 0.435, highlights 0, shadows 0, whites 0, blacks 0 (−100…100), temperature 0, tint 0 (−100…100), vibrance 0, saturation 1 (0…2), hue 0 (−180…180), rolloff 0 (0…100), protectSkin false                            |
| Wheels    | lift, gamma, gain, offset: `{ x 0, y 0, m 0 }` each (x/y in −1…1 on the wheel, m the master ring); log: shadow, midtone, highlight `{ x, y, m }`, lowRange 0.333, highRange 0.55; zones z0…z5 `{ x, y, m, at }` with `at` defaults 0.06, 0.2, 0.38, 0.62, 0.82, 0.96 |
| Curves    | rgb `{ y, r, g, b }` point lists (identity), hueHue, hueSat, hueLum, lumSat point lists (flat)                                                                                                                                                                       |
| Color mix | eight families (reds, oranges, yellows, greens, aquas, blues, purples, magentas) `{ hue 0, sat 0, lum 0 }`, range 0                                                                                                                                                  |
| Warper    | `points`: sparse offsets `{ [index]: { dh, ds } }` on a 12 × 3 hue-and-strength grid, smoothing 50, pinned indices                                                                                                                                                   |
| Creative  | shadowTint, highlightTint `{ x, y }`, balance 0, fade 0 (0…100), vignette `{ amount 0, midpoint 50, roundness 0, feather 50 }`                                                                                                                                       |
| RGB mixer | matrix 3 × 3 (identity), keepBrightness true, mono false                                                                                                                                                                                                             |
| Skin      | skinPull 0 (0…100)                                                                                                                                                                                                                                                   |

The math of each (how temperature moves channels, how a log wheel weighs its range, how a zone's band
falls off, how rolloff bends, how protect skin masks the skin hues) is the builder's, written once in
`tint/logic/color/` as plain TypeScript (the CPU reference) and once as GLSL. The two must agree within one
8-bit step on a fixed set of test colors; that check runs in the stage 0 harness and before each stage
ships, not as a unit test. Order inside one correction: input conversion is outside; then exposure and
white balance, wheels, contrast and pivot, highlights/shadows/whites/blacks, rolloff, curves, color mix and
warper, saturation/vibrance/hue (with protect skin), skin pull, RGB mixer, creative, LUT, then limit and
opacity mix the result over the correction's input.

## Baby Seal and Leader Seal

`tint/logic/stack.ts` turns a graph into a stack, and stack edits into graph edits.

- A **chain** of corrections is a run of layers, top = closest to the source.
- A **ParallelJoin** whose branches are chains that all start from the same node is a **side-by-side group**:
  a folder of layers; its blend is "Side by side". Output = input + Σ opacityᵢ · (branchᵢ − input).
- A **LayerJoin** of such branches is a **stacked group** with a blend mode per branch (`BLEND_MODES`).
- A **split → three chains → join** is a **per-channel group** with Red, Green and Blue inside.
- A correction with `limit.from` shows its limit as "Uses the pick of 03".
- Groups nest: a group's branch may hold groups.
- **Anything else** (a branch that rejoins elsewhere, crossing branches, a key join, a node feeding two
  places that rejoin at different points) becomes a **sealed card**: the smallest region between a node and
  the node every path through it reaches, with all nodes inside. The card shows "Wired in Leader Seal · edit
  the wiring there" and an Open button; expanding it lists its corrections as rows, whose values edit as
  usual. The card can be turned off, faded, copied and saved as a look. It can't be reordered into or out of.
- Baby Seal edits only make shapes it can show. Leader Seal edits may make any valid graph.

**Leader Seal** draws the graph (SVG), with thumbnails of each node's output, the source and output ends,
picture wires, channel wires in red/green/blue and key wires dashed blue. Drag a node to move it (one
command on release); drag from an output to an input to wire; right-click for **Add node**: Correction, Side
by side, Stacked, Shared key, Per channel; and Reset grade, Tidy up. Groups that Baby Seal knows are drawn
as dashed regions with their name. Node thumbnails and layer thumbnails are the picture at that node, drawn
small (about 96 × 54) after an edit settles, never per playback frame.

## Rendering

### The preview hook (in `preview`)

**One GPU runner, owned by the preview.** WebGL contexts are scarce (browsers cap them per page) and the
preview already has several engines (live, captures, export renderers), so each engine owns one WebGL2
context in `preview/gpu/` and runs every picture pass through it. Filters don't create contexts: they hand
the runner passes (a fragment shader, uniforms, small textures). This also keeps grading off `<video>`
elements (decoding stays the preview's business; filters only see textures).

**Video levels, fixed everywhere.** WebKitGTK draws video black at 15 and white at 236; today only export
corrects it (`LevelCorrection`, a CPU read of every frame). The runner does the same correction as a first
pass on every video layer, in the live preview and captures too, wherever `measureVideoLevels` finds a
squeeze. So the live preview, `preview_capture_frame`, scopes, pickers and export all see the file's real
levels, and `LevelCorrection` goes away. This changes how untouched video looks in the live preview on
Linux: it now matches the export, which was already right (my call; the anti-goal "a preview that lies").
Without a squeeze (or without WebGL2) nothing runs and video draws as today.

- `pictureFilters` point (`preview.points.ts`): `{ id, order, applies(clip, project): boolean,
ready?(clip, project): boolean, passes(info): GpuPass[] }`, run by the engine's runner. The engine calls `apply` on each
  picture clip's source (the video frame after `LevelCorrection`, the cached image, a placement's nested
  canvas) before `land`, so a grade is in the picture's own pixels and scales and blends with it. `info`
  carries the clip as drawn (animated, with live overrides from the filter's owner), the project, the frame
  `path`, the source size, and `target: "preview" | "capture" | "export"` with a size cap. `ready` false holds
  the frame like an undecoded video (rule 22). A filter that throws: in the preview, the picture draws
  ungraded and the user is told once; in `frameAt` (export) the frame fails, so the export fails with the
  message.
- `frameFilters` point: the same, applied to a composition's composed frame (top level and inside a
  placement), for the whole-timeline grade.
- `PreviewApi.view`: `bypassFilters` (Bypass grades) and `compare` (`{ wipe: 0…1 } | null`: the frame is
  drawn once with filters and once without, clipped at the wipe). Live preview only; captures and export
  never read them.
- `PreviewApi.onFrame(listener)` after each drawn frame, and `readFrame(maxWidth)` → `ImageData` of the
  current frame scaled down on a small canvas, for scopes, sample points and pickers. The main canvas stays
  as it is (never `willReadFrequently`).
- `captureAt` gains `{ bypassFilters?, only?: clipId }` so pickers and matching can read a clip's own,
  ungraded picture.

### The grade passes (in `tint`)

- `tint/render/`: turns a clip's grade into `GpuPass[]` for the preview's runner: input conversion → the
  graph, evaluated in topological order (a pass may read several earlier outputs, so joins and branches
  work) → output. The runner pools framebuffers and draws the result back as a canvas the engine lands.
- One shader program per correction, with uniforms for every field; curves, Color mix and the warper are
  baked on the CPU into small textures (1D curves of 1024 samples, a hue × strength table for the warper),
  rebuilt only when their values change. LUTs are 3D textures. The vignette uses the picture's own
  coordinates.
- Texture format: half-float targets when the stage 0 check finds them on both platforms, else 8-bit with
  dithering. The check decides; the plan records it.
- Live grading resolution is capped to the preview canvas size (like placements); export renders at full
  size.
- A lost WebGL context is recreated on the next frame; the preview tells the user once if that fails.
- **Live edits:** a drag writes into `tint`'s live store (never history) and asks for a redraw; release
  runs one command (rule 15). The filter merges live values over the saved grade.

### Color management

Input: Rec.709 (default), sRGB, Sony S-Log3 / S-Gamut3.Cine, Apple Log, Canon C-Log2, Canon C-Log3,
Panasonic V-Log, Fujifilm F-Log, from the makers' published formulas, converted to Rec.709 gamma 2.4 before
any correction. Grading happens there, display-referred, which is how most editors work and what the
wheels' feel assumes. The LUT tab shows the camera space as a choice and the working and output spaces as
plain text ("Grading in Rec.709 · Output Rec.709 gamma 2.4"), with no dropdowns, since there is nothing else
to choose (my call; the mockup showed dropdowns).

### Scopes

`tint/ui/scopes/` draws Parade, Waveform, Histogram and the Vectorscope on canvases from `readFrame(256)`
of the final frame, at most 15 times a second while playing and once per change while paused, without React
state (rule 24). Scales: 0–1023 on waveform and parade, the six targets and the skin line on the
vectorscope. The same numbers are available to agents (`tint_scopes`).

## Tools, by tab

Fields, ranges and defaults are in the table above; this is what each tab shows. Tooltips are as in the
mockup.

- **Basics:** Light (exposure, contrast, highlights, shadows, whites, blacks, highlight rolloff), Color
  (temperature, tint, vibrance, saturation, protect skin), One click (Auto balance, Pick white, Match to
  another clip, Apply a look).
- **Wheels:** Primary (lift, gamma, gain, offset, each with four number fields and a jog bar), Log (shadow,
  midtone, highlight, with low and high range), Bars (the same as per-channel sliders), Zones (six wheels
  with a band position each). Temperature, tint, contrast, pivot, saturation and hue sit beside the wheels.
- **Curves:** Custom (Y, R, G, B), Hue vs Hue, Hue vs Saturation, Hue vs Brightness, Brightness vs
  Saturation; add points by clicking, remove by dragging off, Pick hue with the dropper.
- **Color mix:** eight family dots, Pick from the picture, hue/saturation/brightness/range for the chosen
  family, a bar chart of all families.
- **Warper:** the hue-and-strength grid (12 hues × 3 rings), drag points, Smoothing, Pin, Reset. My call:
  only the hue-and-strength mode ships; the mockup's "Color · brightness" mode is left out.
- **Creative:** split toning (two small wheels and balance), faded film, vignette (amount, midpoint,
  roundness, feather).
- **Limit:** By color (on/off, Pick, +, −, hue/saturation/brightness ranges), By brightness (on/off, Darks /
  Mids / Brights presets, range, softness), Refine (softness, clean up, Show picked, Invert). Shared key is
  chosen from a "Use the pick of" menu.
- **LUT and color:** LUT list (built-ins and imported), Import .cube, strength; camera color space.
- **Match:** Balance (Auto, White, Gray), Another shot (Match to <clip>, Match all to this), Color chart
  (place a 24-patch grid over the chart in the viewer by its four corners, then Calibrate), Skin (pull
  amount, protect skin).
- **RGB mixer:** the 3 × 3 matrix, keep brightness, monochrome.

Pickers (dropper, Pick white/gray, chart) read the clip's own ungraded picture at that point, run it through
the corrections above the current one with the CPU reference, and write values into the current one.

## Viewer tools

Bypass grades (`Shift D`), Before/after wipe (drag the line), Side by side (this clip beside another clip's
frame or a still), Sample points (hover readout; click pins up to three, kept in the view store), False color
(seven bands: crushed, shadow, mid gray, skin, light, near clip, clipped, with a legend), Clip warning
(magenta over clipped areas), Guides (action and title safe), Clean viewer (full screen; `Esc` leaves).
All are view state: never in the document, never in captures or export. False color and the clip warning
are an overlay canvas drawn from `onFrame` through a small WebGL pass.

## Across shots

- **Copy / Paste / Paste to all:** a per-actor clipboard (as keyframes do). Paste part opens a menu of tools
  (Basics, Wheels, Curves, Color mix, Creative, Limit, LUT and color) and pastes those fields only, into the
  matching corrections by position, adding corrections when the target has fewer.
- **Shot groups:** Make shot group from selected clips; the clips bar's level switch chooses whether the
  page edits the clip's grade, its group's or the composition's.
- **Versions:** A, B, C…; create, switch, rename, delete.
- **Match:** Auto balance (neutral average and spread), Match to another shot (match mean and spread per
  channel in a log space, into a new "Match 01" correction at the bottom), Match all to this, Color chart
  (least-squares 3 × 3 matrix and per-channel offsets against published reference values, into a "Chart"
  correction at the top), Skin pull.
- **Looks:** a `tintLooks` point (`tint.points.ts`) for built-in and plugin looks, each a list of
  corrections. Built-ins have our own names: Golden hour, Teal and orange, Bleach bypass, Soft film, Night
  blue, Mono. Applying a look adds its corrections as a group at the bottom of the stack, one undo step.
- **Stills:** Grab still saves the current graded frame (JPEG data URL, at most 320 px wide) with the grade.
  Click to apply its grade; use it in Side by side.

## Keyframes

`tint.keys` (`keyTargets`): every scalar of every correction of the clip's own grade
(`grade.nodes.<id>.values.<field>`, `…opacity`), with labels like "03 Skin · Saturation". Group and
timeline grades aren't keyed (my call). The header's diamond keys the current correction's changed fields
at the playhead (`keyframe.setMany`). Removing a node drops its tracks in the same command. While a field
has keys, a drag sets a key at the playhead.

## Agents

Every edit is a `tint.*` command with a `snake_case` tool (rule 18). Node commands take a `target`:
`{ clipId }`, `{ groupId }` or `{ compositionId }`.

| Command               | Tool                      | Does                                                                                |
| --------------------- | ------------------------- | ----------------------------------------------------------------------------------- |
| `tint.addCorrection`  | `tint_add_correction`     | Adds a correction above/below a node, with optional values and limit                |
| `tint.setCorrection`  | `tint_set_correction`     | Patches values, limit, opacity, on, name of one node                                |
| `tint.removeNodes`    | `tint_remove_nodes`       | Removes nodes and their key tracks; rewires around them                             |
| `tint.moveLayer`      | `tint_move_layer`         | Reorders in the stack (Baby Seal shapes only)                                       |
| `tint.group`          | `tint_group`              | Wraps layers in a side-by-side, stacked or per-channel group; `tint.ungroup` undoes |
| `tint.wire`           | `tint_wire`               | Leader Seal: sets inputs of nodes, adds join/split/key nodes                        |
| `tint.placeNodes`     | (none)                    | Node positions; the user's layout                                                   |
| `tint.reset`          | `tint_reset`              | All of a grade, or some tools' fields                                               |
| `tint.copy` / `paste` | `tint_copy`, `tint_paste` | Per-actor clipboard; paste takes `parts`                                            |
| `tint.setInput`       | `tint_set_input`          | Camera color space                                                                  |
| `tint.importLut`      | `tint_import_lut`         | Adds a `.cube` file by path                                                         |
| `tint.applyLook`      | `tint_apply_look`         | A look or a still's grade                                                           |
| `tint.setVersion`     | `tint_set_version`        | Create, switch, rename, delete                                                      |
| `tint.setShotGroup`   | `tint_set_shot_group`     | Make, join, leave a shot group                                                      |
| `tint.match`          | `tint_match`              | Auto, white, gray (at a point), another shot, chart (corners)                       |
| `tint.grabStill`      | `tint_grab_still`         | Saves a still; `tint.removeStill`                                                   |
| (read)                | `tint_get_grade`          | The grade as layers (with numbers, sealed regions) and as nodes                     |
| (read)                | `tint_scopes`             | Per-channel levels, clipped share, histogram buckets, skin-line distance at a time  |
| (read)                | `tint_describe`           | Fields with ranges, tools, color spaces, looks, LUTs                                |

Viewer toggles (bypass, compare, samples, false color) are the user's view and get no tools.
`project_get_state` already includes the grade (rule 19).

## Saving

`workspace`'s `.cclip` goes to version 4 when the document holds a `grade`, `gradeVersions`, `gradeGroup`,
`gradeGroups`, `luts` or `stills`; otherwise it stays at its current version, so a project that never used
Tint opens in an older app. LUTs are kept by path, like media; a missing LUT file is marked missing,
relinked like media, drawn without that LUT in the preview with a warning, and fails an export.

## Names

Baby Seal, Leader Seal, Correction, Side by side (group), Stacked (group), Per channel (group), Shared key,
Wired in Leader Seal (sealed card), Color mix, Warper, Zones, Highlight rolloff, Protect skin, Skin pull,
Clip warning, False color, Clean viewer, Shot group, Whole timeline, Versions, Looks, Stills, 24-patch chart.

## Keeping it right

- **Stage 0 check** (`docs/superpowers/specs/2026-11-03-tint-webgl-check.md`, written by the builder):
  WebGL2 context, video and canvas upload, half-float render targets, 3D textures, a render from a hidden
  window (as `captureAt` does), time per graded 1080p and 4K frame, WebKitGTK and WebView2.
- **Parity:** the CPU reference and the shader agree within one 8-bit step on a fixed color set; an export of
  a graded clip matches `preview_capture_frame` of the same frame within that step.
- **Untouched is unchanged:** a project with no grade exports byte-identical pixels before and after this
  work.
- **Speed:** a 1080p clip with five corrections plays at the project frame rate on the owner's machine.
- **Tests kept** (rule 3): `validateGrade` and the stack conversion (`logic/stack.test.ts`), and the undo and
  validation of the node commands (`tint.commands.test.ts`). Anything else a stage adds is deleted at its end.

## Decisions after review

- **8-bit for v1.** Grading works from what the app decodes today (8-bit), in preview and export. Heavy
  grades on 10-bit log footage can band; a 10/16-bit export path is a later project.
- **If stage 0 fails on a platform,** Tint is off there: the page shows an empty state saying grading isn't
  available on this system, clips keep their grades in the file, and an export of a graded clip on that
  system fails with `tint.unavailable`. No CPU fallback renderer.
- **Current clip and selection.** The strip lists picture clips of every video track, in time order,
  tagged V1, V2… Clicking a clip pins it as current until another is clicked or the playhead leaves it;
  without a pin, the current clip is the one under the playhead on the topmost visible video track.
  Ctrl/Shift click selects several. That selection is the timeline's own (`TimelineApi.selectClip`), shared
  with Edit; Paste, Match all and Make shot group act on it.
- **Parity check** compares the export with a full-size `createRenderer` frame drawn from the masters, not
  with `preview_capture_frame` (which plays proxies).

## Calls I made (check these)

0. Video levels are corrected in the live preview too, so untouched video on Linux now looks like its export.
1. A shot group's grade runs after the clip's own grade.
2. Text, stickers and solids aren't graded.
3. Grading is display-referred in Rec.709; working and output spaces aren't choices.
4. The Warper ships one mode (hue and strength).
5. Group and whole-timeline grades can't be keyed.
6. Applying a look adds it as a group at the bottom of the stack.
7. A placed composition carries its whole-timeline grade wherever it's placed.
8. Clicking a clip in the strip moves the playhead to the frame last viewed in it, else its middle.

## Left to the builder

The color math and shader layout; texture formats after the check; the sealing algorithm's details; node
auto-layout; scope sampling rates within the stated cap; how Paste part matches corrections when shapes
differ; exact component split and sizes (follow the mockup); whether `Tooltip`, `InfoTip` and `ScrubField`
join `@/ui` or reuse something there.
