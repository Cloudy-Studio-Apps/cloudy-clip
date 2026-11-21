# Subtitles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any text clip can be marked as a subtitle that follows a named style of its composition; a Subtitles page lists, types, times and styles every cue; `.srt` / `.vtt` come in and `.srt` goes out.

**Architecture:** The mark (`Clip.subtitle`) and the styles (`ProjectState.subtitleStyles`) are project data; the project's `settle` keeps marks pointing at a style of the clip's own composition (copying it across on paste, group or duplicate), so no other module copies styles. A style's values are **written into its cues** through nested `element.setProps`; a value is a cue's own when it differs from its style, and a style edit rewrites only the cues whose value still equals the style's old value. A new feature module `subtitle` owns commands, MCP tools, the page, the badge and the menu; the timeline gets a `"subtitle"` scope; `media` gets real waveform peaks for the page's Sound row.

**Tech Stack:** TypeScript strict, React 19, Zod, Immer, Zustand, Vitest; Rust (Tauri 2, tokio, system FFmpeg). No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-21-subtitles-design.md` · **Prototype:** `docs/prototype/designs/subtitles-page.html` (the look and every interaction; follow it, in the app's tokens and kit).

## Global Constraints

- Commits carry **no** `Co-Authored-By` or any Claude attribution line. Stage only your task's files: the tree holds unrelated uncommitted edits (`src/modules/path/*`, `CHANGELOG*.md`).
- No legacy support: no migrations, no compatibility shims; the project file simply becomes version 7.
- Rule 3: tests only for document integrity and undoable commands (`project` settle/undo, `subtitle.*` commands). UI, gestures, Rust and the peaks get no committed test.
- Rule 23: no `clip.kind` checks outside `text`; use `isTextClip(clip)` exported by `text` (Task 2).
- Rules 4/5/9/10/18/28/29/31: public entry points only; types in `.types.ts`; TSDoc on every export, command and tool; tools are `commandTool(command, { name })` named `subtitle_*`; `requires` lists exactly what is used.
- Every edit is one undo step; a gesture sends one command on release (rule 15); no React state on per-frame or drag paths (rule 24).
- Style presets (`logic/presets.ts`), values as text props in output px for the composition's format, sizes as fractions of the short side like `text`'s presets:
  - **Classic** (the first style, named `Default`): bold, white fill, shadow on, background off, sized for two lines, `position.y` at 0.32 × height below center.
  - **Punchy**: bundled Inter at weight 900, uppercase, large, outline on, shadow off, `position.y` 0.
  - **Intense**: Punchy with fill `#ffd54a`, `position.y` 0.16 × height.
  - **Whisper**: italic, smaller, background on (`#1b2a36`, opacity 0.8), shadow off, `position.y` 0.34 × height.
- A cue is at least `minClipDuration` long and never overlaps a clip on its track (the timeline's rules).
- Failure codes: `subtitle.clip_not_found`, `subtitle.not_text`, `subtitle.not_marked`, `subtitle.style_not_found`, `subtitle.last_style`, `subtitle.composition_not_found`, `subtitle.overlap`, `subtitle.split_outside`, `subtitle.not_adjacent`, `subtitle.empty_file`, `subtitle.invalid_style`.
- Update each touched module's README (template in `docs/modules.md`) in the task that changes it; CHANGELOG.md / CHANGELOG.es.md, `CLAUDE.md` and `docs/modules.md` in the last task.
- Done = `pnpm typecheck`, `pnpm lint`, `pnpm test` pass; Rust tasks also `cargo clippy --all-targets -- -D warnings` and `cargo test` in `src-tauri`.

## Review Focus

1. A style edit whose value the text element normalizes on the cue (a weight the family lacks, a color in upper case) must not turn every cue into "own": the style stores the normalized value. Test in Task 3.
2. A style edit on a field a cue has keyed (`clip.animation["fill.color"]`) leaves the keys untouched and writes nothing static over them. Test in Task 3.
3. Pasting cues into another composition (and grouping them into a new one) copies their style there; the cues look the same; undo removes the copy. Test in Task 1.
4. Splitting a cue (`timeline.splitAt`, Split in the menu, `subtitle.splitCue`) and Freeze frame keep the mark on both parts. Test in Task 1.
5. An `.srt` with a BOM, CRLF, a broken block and overlapping cues imports the good cues, puts the overlaps on a second new track and reports what it skipped. Test in Task 4.

## Files

```
src/core/shell/shell.types.ts               M  TimelineScopeName + "subtitle"; Keybinding.alt?
src/app/app.keybindings.ts                  M  match alt
src/app/bootstrap.ts                        M  subtitleModule
src/ui/logic/window.ts                      C  visibleWindow (moved from text/logic/fontpick.ts)
src/ui/index.ts, src/ui/README.md           M
src/modules/project/
  project.types.ts                          M  SubtitleStyleId, SubtitleStyle, ClipSubtitle; Clip.subtitle?; ProjectState.subtitleStyles?; Composition.subtitleStyleOrder?
  logic/subtitles.ts                        C  settleSubtitles, subtitleProblem, stylesOf
  logic/fields.ts                           M  validate + settle + diffOptional("subtitleStyles")
  project.subtitle.test.ts                  C
  project.mcp.ts, index.ts, README.md       M  styles per composition in project_get_state
src/modules/workspace/logic/format.ts       M  VERSION 7, subtitleStyles, subtitleStyleOrder, clip.subtitle
src/modules/timeline/
  timeline.split.commands.ts                M  copy subtitle
  logic/scope.ts, timeline.layout.ts        M  subtitle scope, CONTEXT_HEIGHT
  ui/TimelinePanel.tsx, ui/TrackInsert.tsx, ui/TimelineToolbar.tsx  M  scope filters
  timeline.menu.ts, README.md               M  opt-ins
src/modules/speed/speed.commands.ts         M  freeze keeps subtitle
src/modules/composition/composition.settings.commands.ts, composition.module.ts, README.md  M  scale style positions; tabs opt in
src/modules/marker/marker.module.ts, src/modules/collab/collab.module.ts  M  opt in to "subtitle"
src/modules/inspector/
  ui/PanelSection.tsx (+ SubSection, ToggleRow), ui/controls/FieldItem.tsx, logic/conditions.ts  M  off switch disables, never hides
  logic/junction.ts → logic/source.ts       M  layoutSourceOf(kind, properties)
  index.ts, README.md                       M  export PropertyPanel, createPropsLive, layoutSourceOf
src/modules/text/
  logic/fontpick.ts, ui/FontList.tsx        M  visibleWindow from @/ui
  text.guards.ts                            C  isTextClip
  index.ts, README.md                       M  export isTextClip, defaultTextStyle, textStyleOf, normalizeTextStyle
src/modules/media/
  media.peaks.ts                            C  peaks cache (MediaApi.peaks)
  media.service.ts, media.types.ts, media.module.ts, index.ts, README.md  M
src-tauri/src/media/peaks.rs                C  media_peaks
src-tauri/src/media/mod.rs, src-tauri/src/lib.rs  M
src-tauri/src/subtitle/mod.rs               C  subtitle_read_text, subtitle_write_text
src/modules/subtitle/                       C  feature module
  index.ts subtitle.ref.ts subtitle.module.ts subtitle.types.ts README.md
  subtitle.schema.ts                        Zod: preset id, style patch, position
  subtitle.guards.ts                        requireCue, requireText, requireStyle, compositionOf
  subtitle.style.commands.ts                addStyle, updateStyle, renameStyle, removeStyle, reorderStyles
  subtitle.mark.commands.ts                 mark, unmark, resetToStyle
  subtitle.cue.commands.ts                  addCue, splitCue, mergeCues
  subtitle.import.command.ts                import
  subtitle.commands.test.ts
  subtitle.mcp.ts                           tools + subtitle_to_srt
  subtitle.store.ts                         createSubtitleView (edge, tab, styleId)
  subtitle.service.ts                       pick/read/save files (dialog + invoke)
  subtitle.keys.ts                          [ ] Alt+←/→ bindings
  subtitle.menu.ts                          clip action: badge, Mark / Style ▸ / Remove
  logic/presets.ts logic/overrides.ts logic/srt.ts logic/lanes.ts logic/context.ts logic/time.ts
  ui/SubtitlePage.tsx ui/CueList.tsx ui/CueRow.tsx ui/TimeField.tsx ui/SubtitleStage.tsx
  ui/SubtitleSide.tsx ui/StyleTab.tsx ui/StyleList.tsx ui/CueTab.tsx ui/OwnValueAction.tsx
  ui/ContextBand.tsx ui/CueBadge.tsx ui/index.ts
CLAUDE.md, docs/modules.md, CHANGELOG.md, CHANGELOG.es.md  M
```

---

### Task 1: The data, integrity and the places that copy clips

**Files:** Modify `project/project.types.ts`, `project/logic/fields.ts`, `project/project.mcp.ts`, `project/index.ts`, `project/README.md`, `workspace/logic/format.ts`, `workspace/README.md`, `timeline/timeline.split.commands.ts`, `speed/speed.commands.ts`, `composition/composition.settings.commands.ts`. Create `project/logic/subtitles.ts`, `project/project.subtitle.test.ts`.

**Interfaces — Produces** (from `@/modules/project`):

```ts
export type SubtitleStyleId = string;
/** A named look for subtitles of one composition. `props` are text element values, stored whole. */
export interface SubtitleStyle {
  id: SubtitleStyleId;
  compositionId: CompositionId;
  name: string;
  color: MarkerColor; // its dot in the cue list and the badge
  props: Record<string, unknown>;
  position: { x: number; y: number }; // output px from the frame's center
}
export interface ClipSubtitle {
  styleId: SubtitleStyleId;
}
// Clip.subtitle?: ClipSubtitle
// ProjectState.subtitleStyles?: Record<SubtitleStyleId, SubtitleStyle>
// Composition.subtitleStyleOrder?: SubtitleStyleId[]   (first = default style)
export function stylesOf(state: ProjectState, compositionId: CompositionId): SubtitleStyle[]; // in order
export function settleSubtitles(draft: Draft<ProjectState>): void;
```

- [ ] **Step 1: Write the failing tests** in `project.subtitle.test.ts` (seed with the project testing helpers, as `project.undo.test.ts` does; a text clip is a clip with `kind: "text"`):
  - `drops the styles of a deleted composition`: delete composition A → `subtitleStyles` has none with `compositionId` A.
  - `copies a style into the composition a marked clip moved to`: style S in A, clip marked S moved (by mutate) to a track of B → the clip's `styleId` is a new style in B with S's name, color, props and position; `B.subtitleStyleOrder` ends with it; two clips moved together share one copy.
  - `drops a mark whose style is gone`: remove S without moving its cues → the cues have no `subtitle`, their `props` unchanged.
  - `undo of a paste removes the copied style` (run `timeline.paste` across compositions, then undo).
  - `split and freeze keep the mark`: `timeline.splitAt` and `speed.freezeFrame` on a marked clip → every resulting clip has the same `subtitle`.
  - `order lists only existing styles`: `subtitleStyleOrder` never names a missing style after settle.

- [ ] **Step 2: Run** `pnpm vitest run src/modules/project/project.subtitle.test.ts` → FAIL (types missing).

- [ ] **Step 3: Implement.**
  - Types in `project.types.ts` as above (TSDoc each field).
  - `logic/subtitles.ts`: `settleSubtitles(draft)`: drop styles whose composition is gone; drop marks whose style is gone; a mark whose style belongs to another composition than the clip's track → copy that style into the clip's composition (new `createId("sub")` id, reused for every clip of that pass with the same source style) and append it to the order; finally rewrite every `subtitleStyleOrder` to existing ids of that composition and append any style missing from it. `subtitleProblem(state)`: a style without its composition, a mark naming a missing style or one of another composition (never true after settle).
  - `fields.ts`: call `settleSubtitles` last in `settle`; `subtitleProblem` in `validate`; `diffOptional("subtitleStyles", …, true, out)` in `diff`.
  - `project.mcp.ts`: `fullComposition` returns `subtitleStyles` (in order, whole) alongside its existing fields; clips already show `subtitle`.
  - `format.ts`: `VERSION = 7`; `subtitleStyles` record (`z.looseObject`, `color: z.enum(MARKER_COLORS)`, `position: { x, y }` finite), optional; `subtitleStyleOrder` optional on compositions; `subtitle: z.strictObject({ styleId: z.string() }).optional()` on clips; a project using either saves as 7 (first in the version chain).
  - `timeline.split.commands.ts` (the `right` clip, near the `masks` line) and `speed.commands.ts` (the `hold` clip, near `masks`): copy `subtitle` when present.
  - `composition.settings.commands.ts`: with `resize === "scale"`, scale each style of the composition's `position` exactly as a text clip's `transform.x/y` is scaled there (the same `scaleTransform` call with fit `none`, keep x and y).

- [ ] **Step 4: Run** the test file and `pnpm test` → PASS. **Step 5:** update `project/README.md` (types, settle rule, `stylesOf`) and `workspace/README.md` (version 7). **Step 6: Commit** `feat(project): subtitle styles and marks`.

---

### Task 2: Plumbing in shared modules

**Files:** Modify `core/shell/shell.types.ts`, `app/app.keybindings.ts`, `inspector/ui/PanelSection.tsx` (and `SubSection`, `ToggleRow` where they hide items), `inspector/ui/controls/FieldItem.tsx`, `inspector/logic/conditions.ts`, rename `inspector/logic/junction.ts`'s `junctionLayoutSource` to `layoutSourceOf` in `inspector/logic/source.ts` (update its callers), `inspector/index.ts`, `inspector/README.md`, `text/logic/fontpick.ts`, `text/ui/FontList.tsx`, `text/index.ts`, `text/README.md`, `ui/index.ts`, `ui/README.md`. Create `ui/logic/window.ts`, `text/text.guards.ts`.

**Interfaces — Produces:**

```ts
// @/core
export type TimelineScopeName = "all" | "sound" | "subtitle";
// Keybinding gains: alt?: boolean   (matched like shift; missing = Alt not held)
// @/ui
export function visibleWindow(
  scrollTop: number,
  viewport: number,
  rowHeight: number,
  count: number,
  overscan: number,
): { start: number; end: number };
// @/modules/inspector
export { PropertyPanel } from "./ui/PropertyPanel"; // props: subject, source, values, live, renderCommand?
export { createPropsLive } from "./logic/live"; // ({ preview, read, commit }) => PropsLive & { dispose() }
export function layoutSourceOf(kind: string, properties: PropertyTree): LayoutSource;
// @/modules/text
export function isTextClip(clip: Clip): boolean;
export { defaultTextStyle, textStyleOf } from "./logic/layout";
/** The style as a text clip would store it: faces snapped to the family, colors as the patch schema writes them. */
export function normalizeTextStyle(
  style: Record<string, unknown>,
  env: NormalizeEnv,
): Record<string, unknown>;
```

- [ ] **Step 1: Implement.** A group whose header switch is off still draws its fields, **disabled** (each control's own `disabled`): `isEnabled(spec, values, path)` also requires every enclosing group's toggle (`<group>.<toggle>`) to be on; `PanelSection` / `SubSection` / `ToggleRow` stop gating items on `on`. `normalizeTextStyle` runs the text element's `normalize` path (`checkExplicitFace` is skipped; `snapStyleToFamily`, then `parsePatch` of the element's patch schema) without a clip.
- [ ] **Step 2: Run** `pnpm typecheck && pnpm lint && pnpm test` → PASS; open a text clip in Edit (`pnpm tauri dev`): with Outline off its Color and Width show disabled. **Step 3:** READMEs (inspector: switches disable; text: new exports; ui: `visibleWindow`). **Step 4: Commit** `refactor: shared pieces for subtitles (disabled groups, alt keys, exports)`.

---

### Task 3: The subtitle module, styles and marks

**Files:** Create `subtitle/index.ts`, `subtitle.ref.ts`, `subtitle.module.ts`, `subtitle.types.ts`, `README.md`, `subtitle.schema.ts`, `subtitle.guards.ts`, `subtitle.style.commands.ts`, `subtitle.mark.commands.ts`, `subtitle.mcp.ts`, `logic/presets.ts`, `logic/overrides.ts`, `subtitle.commands.test.ts`. Modify `app/bootstrap.ts`.

**Interfaces:**

- Consumes: Task 1 types and `stylesOf`; Task 2 `isTextClip`, `normalizeTextStyle`; `setProps` (`@/modules/element`), `getPath`/`deepEqual` (export them from `@/modules/element` if they aren't).
- Produces:

```ts
export type SubtitlePresetId = "classic" | "punchy" | "intense" | "whisper";
export const addStyle; // "subtitle.addStyle" { compositionId?, name?, preset?: SubtitlePresetId, fromStyleId?, fromClipId? } → { styleId }   (exactly one source; default preset "classic")
export const updateStyle; // "subtitle.updateStyle" { styleId, props?: Record<string, unknown>, position?: { x?: number; y?: number } } → { restyled: ClipId[] }
export const renameStyle; // "subtitle.renameStyle" { styleId, name: 1..60 }
export const removeStyle; // "subtitle.removeStyle" { styleId } → { moved: ClipId[] }   fails subtitle.last_style
export const reorderStyles; // "subtitle.reorderStyles" { compositionId?, styleIds }
export const mark; // "subtitle.mark" { clipIds, styleId? } → { marked: ClipId[] }
export const unmark; // "subtitle.unmark" { clipIds }
export const resetToStyle; // "subtitle.resetToStyle" { clipIds, paths?: string[] }
// logic/overrides.ts (pure)
export function styleLeaves(style: SubtitleStyle): Map<string, unknown>; // "fill.color", "size", …, "transform.x", "transform.y"
export function ownPaths(values: Record<string, unknown>, style: SubtitleStyle): string[];
export function restylePatch(
  values: Record<string, unknown>,
  from: SubtitleStyle | null,
  to: SubtitleStyle,
  keyed: ReadonlySet<string>,
): Record<string, unknown>;
```

`restylePatch`: for each leaf of `to`, skip keyed paths; write `to`'s value when `from` is null (a fresh mark) or the cue's value deep-equals `from`'s; the result is a nested patch (`{ fill: { color } , transform: { x } }`) for one nested `element.setProps`. The first mark or `addStyle` in a composition without styles creates `Default` (Classic) in the same command.

- [ ] **Step 1: Write the failing tests** in `subtitle.commands.test.ts` (kernel + seeded project as in `mask.commands.test.ts`):
  - `mark writes the style over the look and keeps words, keys and masks`.
  - `mark refuses a clip that is not text` → `subtitle.not_text`, nothing written.
  - `marking a marked cue with another style keeps its own values` (its own `fill.color` stays, the rest takes the new style).
  - `the first mark creates Default`; `addStyle fromClipId copies the cue's look`.
  - `updateStyle rewrites only the cues that followed`: cue A follows, cue B has its own `fill.color` → A changes, B keeps its color but follows `size`; one undo restores both and the style.
  - `updateStyle leaves keyed fields alone` (Review Focus 2).
  - `updateStyle stores what a cue would store` (Review Focus 1): a weight the family lacks → style holds the snapped weight; `ownPaths` of every following cue is empty.
  - `removeStyle moves its cues to the default style` with the follow rule; `removing the last style fails`.
  - `unmark keeps the look` (props and transform unchanged, mark gone).
  - `resetToStyle writes the style's values` (all, or the given paths).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** commands (validate everything before writing; nested `element.setProps` per cue; `ctx.mutate` for styles), MCP (`subtitle_add_style`, `subtitle_update_style`, `subtitle_rename_style`, `subtitle_remove_style`, `subtitle_reorder_styles`, `subtitle_mark`, `subtitle_unmark`, `subtitle_reset_to_style`), module (`tier: "feature"`, `requires`: project, element, text, fonts as used), bootstrap entry. **Step 4: Run** → PASS, full `pnpm test`. **Step 5:** README with the command table. **Step 6: Commit** `feat(subtitle): styles and marks`.

---

### Task 4: Cues, import and export

**Files:** Create `subtitle/subtitle.cue.commands.ts`, `subtitle.import.command.ts`, `subtitle.service.ts`, `logic/srt.ts`, `logic/lanes.ts`, `src-tauri/src/subtitle/mod.rs`. Modify `subtitle.mcp.ts`, `subtitle.module.ts`, `subtitle.commands.test.ts`, `README.md`, `src-tauri/src/lib.rs`.

**Interfaces — Produces:**

```ts
export const addCue; // "subtitle.addCue" { compositionId?, trackId?, start: Micros, duration: Micros, text, styleId? } → { clipId }
export const splitCue; // "subtitle.splitCue" { clipId, at: int (character index), text?: string } → { clipIds: [ClipId, ClipId] }
export const mergeCues; // "subtitle.mergeCues" { clipIds: [ClipId, ClipId], text?: string } → { clipId }
export const importSubtitles; // "subtitle.import" { compositionId?, text, format: "srt" | "vtt", name?, styleId? } → { clipIds, trackIds, skipped: number }
export function parseSubtitles(
  text: string,
  format: "srt" | "vtt",
): { cues: { start: Micros; end: Micros; text: string }[]; skipped: number };
export function toSrt(state: ProjectState, compositionId: CompositionId): string;
export function laneOf(cues: readonly { start: Micros; end: Micros }[]): number[]; // greedy: first lane whose last end ≤ start
// subtitle.service.ts
export function pickSubtitleFile(): Promise<string | null>;
export function readSubtitleFile(path: string): Promise<string>;
export function saveSrt(contents: string, suggestedName: string): Promise<string | null>;
```

- `addCue` without `trackId`: the track of the cue before `start` in the composition, else a new top video track (`timeline.addTrack` `index: 0`, name "Subtitles"); `subtitle.overlap` if it would overlap; the clip is made with `timeline.addElement` (`kind: "text"`, props `{ text }`) then marked.
- `splitCue`: `at` strictly inside the words, else `subtitle.split_outside`; the cut time is `start + duration × at / length` rounded to a frame and kept inside the clip by at least `minClipDuration`; nested `timeline.splitAt` with `clipIds: [clipId]`, then each half's words (trimmed at the cut) with one `element.setProps` each. `text`, when given, is the row's words as typed (so typing and splitting are one undo step).
- `mergeCues`: the second starts where the first ends on the same track (±1 µs), else `subtitle.not_adjacent`; trim the first's end to the second's end after deleting the second; words joined with one space (or `text`).
- `import`: parse (strip a BOM; CRLF; times `hh:mm:ss,mmm` and `mm:ss.mmm`; a VTT cue's settings after the end time ignored; tags `<…>` stripped; `WEBVTT`/`NOTE`/`STYLE` blocks skipped silently; a block with no time line, an empty text or end ≤ start counts in `skipped`), `subtitle.empty_file` when no cue; one new top track per lane from `laneOf`, named `name` (`name (2)` for the second lane) or "Subtitles"; every cue marked with `styleId` or the default style.
- `toSrt`: marked, enabled clips of the composition's own tracks, sorted by start then track order; times rounded to ms; words as stored.
- Rust `subtitle/mod.rs`: `subtitle_read_text(path)` and `subtitle_write_text(path, contents)` as `tint_read_lut` does (`workspace::file_path`, extensions `srt` or `vtt`, 8 MB cap, `AppError`), registered in `lib.rs`.
- MCP: `subtitle_add_cue`, `subtitle_split_cue`, `subtitle_merge_cues`, `subtitle_import` (`commandTool`), and read-only `subtitle_to_srt` `{ compositionId? }` → `textResult(srt)`.

- [ ] **Step 1: Write the failing tests:** `addCue on the cue track and on a new top track`; `addCue refuses an overlap`; `splitCue cuts by the share of the words and both halves stay marked` (Review Focus 4); `splitCue with typed text is one undo step`; `mergeCues joins adjacent cues` / `refuses a gap`; `import reads srt and vtt` (Review Focus 5 fixture: BOM, CRLF, a broken block, two overlapping cues → 2 tracks, `skipped: 1`); `import of an empty file fails`; `toSrt writes cues in order with ms times`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `cargo clippy --all-targets -- -D warnings && cargo test`. **Step 5:** README. **Step 6: Commit** `feat(subtitle): cues, .srt and .vtt import, .srt export`.

---

### Task 5: Waveform peaks in `media`

**Files:** Create `src-tauri/src/media/peaks.rs`, `src/modules/media/media.peaks.ts`. Modify `src-tauri/src/media/mod.rs`, `src-tauri/src/lib.rs`, `media/media.service.ts`, `media/media.types.ts`, `media/media.module.ts`, `media/index.ts`, `media/README.md`.

**Interfaces — Produces:**

```ts
/** Peaks per second of a file's sound. */
export const PEAKS_PER_SECOND = 50;
// MediaApi gains:
/** The file's sound as peaks, 0–255, PEAKS_PER_SECOND per second of the file; null when it has no sound. Scanned once per file and kept per kernel. */
peaks(mediaId: MediaId): Promise<Uint8Array | null>;
/** The peaks if already scanned (for drawing), else undefined. */
peaksNow(mediaId: MediaId): Uint8Array | undefined;
onPeaks(listener: (mediaId: MediaId) => void): () => void;
```

- Rust `media_peaks(path: String) -> tauri::ipc::Response`: system FFmpeg `-v error -i <path> -vn -ac 1 -ar 8000 -f s16le pipe:1`, read the pipe in chunks, one byte per `8000 / 50` samples (max |sample| scaled to 0–255), return the bytes as a raw IPC response; the master file, never a proxy (same audio). An error or no audio stream → empty response → `null`.
- [ ] **Step 1: Implement**; one scan in flight per file; failure reported once with `notify("error", …)`. **Step 2:** `cargo clippy … && cargo test`, `pnpm typecheck && pnpm lint && pnpm test`. **Step 3:** README. **Step 4: Commit** `feat(media): sound peaks of a file`.

---

### Task 6: The timeline's `"subtitle"` scope

**Files:** Modify `timeline/logic/scope.ts`, `timeline/timeline.layout.ts`, `timeline/ui/TimelinePanel.tsx`, `timeline/ui/TrackInsert.tsx`, `timeline/ui/TimelineToolbar.tsx`, `timeline/timeline.menu.ts`, `timeline/README.md`, `marker/marker.module.ts`, `collab/collab.module.ts`, `composition/composition.module.ts`.

**Interfaces — Produces** (from `@/modules/timeline`):

```ts
export function trackInScope(track: Track, scope: TimelineScopeName, state: ProjectState): boolean; // subtitle: video track holding ≥ 1 marked clip
export function clipInScope(clip: Clip, scope: TimelineScopeName): boolean; // subtitle: clip.subtitle !== undefined
export const CONTEXT_HEIGHT = 44; // rowsAbove("subtitle") = RULER_HEIGHT + CONTEXT_HEIGHT
```

- [ ] **Step 1: Implement.** `TimelinePanel` lists tracks with the new `trackInScope` and draws only `clipInScope` clips; Track insert and the Video track button are hidden on `"subtitle"`; `timeline.clip` and its Split entry, marker flags, collab playheads and the composition tabs add `"subtitle"` to `scopes`; snapping is unchanged (clip edges of every track and the playhead are already candidates). Update every caller of `trackInScope` for its new `state` argument.
- [ ] **Step 2:** `pnpm typecheck && pnpm lint && pnpm test`. **Step 3:** README (Scopes paragraph). **Step 4: Commit** `feat(timeline): subtitle scope`.

---

### Task 7: The Subtitles page: cue list, timing, stage and band

**Files:** Create `subtitle/subtitle.store.ts`, `subtitle.keys.ts`, `logic/context.ts`, `logic/time.ts`, `ui/SubtitlePage.tsx`, `ui/CueList.tsx`, `ui/CueRow.tsx`, `ui/TimeField.tsx`, `ui/SubtitleStage.tsx`, `ui/ContextBand.tsx`, `ui/index.ts`. Modify `subtitle.module.ts`, `subtitle.ref.ts`, `subtitle.types.ts`, `README.md`.

**Interfaces:**

- Consumes: Tasks 3–6; `PreviewStage`, `seek`, `playback.onTime` (`@/modules/preview`); `TimelinePanel`, `selectClip`, the view selection, `trimClip`, `moveClip`, `useHeaderWidth`, `CONTEXT_HEIGHT` (`@/modules/timeline`); `visibleWindow` (`@/ui`); `useVisibleLayers` (`@/modules/transform`) for picking a cue in the frame.
- Produces: `SUBTITLE_PAGE = "subtitle"`; `SubtitleApi { view: StoreApi<SubtitleViewState> }`, `SubtitleViewState { edge: "start" | "end"; tab: "style" | "cue"; styleId: SubtitleStyleId | null }`; `pictureCuts(state, compositionId): Micros[]` (edges of picture clips that aren't cues, deduplicated); `soundLine(state, compositionId, peaksOf, from, to, buckets): Uint8Array` (max over unmuted audio tracks' clips, mapped through `sourceIn` and speed); `parseTime(text): Micros | null` (`m:ss.cc` or seconds), `nudge(fps): Micros` (one frame).

- [ ] **Step 1: Implement**, following the prototype:
  - Page (`appPages`: label "Subtitles", icon `Captions`, ordered after Edit and before Sound, `keepsPlayback: true`, `timelineScope: "subtitle"`): transport row (timecode, play, Add cue, Import, Export .srt, cue count, undo), then cue list | stage | side (Task 8), then `TimelinePanel scope="subtitle"`.
  - Cue list: fixed 64 px rows, virtualized with `visibleWindow`; each row a start/end/length `TimeField`, a `<textarea>` of the words, the style's color dot and ◆ when `ownPaths` is non-empty. Enter splits at the caret (`splitCue` with the typed `text`), Shift+Enter a new line, Backspace at 0 merges with the cue before on the same track (`mergeCues`), ↑ at 0 / ↓ at the end move rows, Esc leaves; words commit on blur (one `element.setProps`). A row click selects (timeline view selection) and seeks to the start; Ctrl/Shift select several. The row under the playhead is marked through `playback.onTime` writing a class on the DOM (no React state).
  - `TimeField`: drag sideways nudges one frame per 4 px and commits one `trimClip` / `moveClip` on release; a click opens a text field (`parseTime`); a clamped value says so (`notify("info", …)`); touching start or end sets `view.edge`.
  - Keys (`subtitle.keys.ts`, resolve to `null` off this page or without one selected cue): `[` / `]` → `trimClip` at the playhead; `Alt+←` / `Alt+→` → `trimClip` of `view.edge` by one frame; with Shift → `moveClip` by one frame.
  - Stage: `PreviewStage bare` with one layer over it: a click selects the topmost cue under the pointer (`useVisibleLayers`), a double-click focuses its row.
  - Context band (`timelineOverlays`, `scopes: ["subtitle"]`, sticky under the ruler, `CONTEXT_HEIGHT`): Picture row (segments between `pictureCuts`), Sound row (a canvas the width of the viewport, redrawn on scroll, zoom and `media.onPeaks`, from `soundLine`), both at half opacity, a click seeks; the cuts as faint dashed lines through the cue lanes.
  - Import: `pickSubtitleFile` → `readSubtitleFile` → `importSubtitles` (name from the file); Export: `toSrt` → `saveSrt`; results and failures through `notify`.
- [ ] **Step 2:** `pnpm typecheck && pnpm lint && pnpm test`; live in `pnpm tauri dev`: import an `.srt`, type, split, merge, `[`/`]`, Alt+arrows, drag a cue onto a cut (snaps), export. **Step 3:** README. **Step 4: Commit** `feat(subtitle): the Subtitles page`.

---

### Task 8: Styles and cue values in the side panel; the Edit page

**Files:** Create `subtitle/ui/SubtitleSide.tsx`, `ui/StyleTab.tsx`, `ui/StyleList.tsx`, `ui/CueTab.tsx`, `ui/OwnValueAction.tsx`, `ui/CueBadge.tsx`, `subtitle.menu.ts`. Modify `subtitle.module.ts`, `README.md`.

- [ ] **Step 1: Implement.**
  - Side panel tabs **Style | Cue** (`view.tab`).
  - Style tab: `StyleList` (color dot, name, cue count; click selects, double-click renames, drag reorders, the first marked "default"), New style (menu: the four presets, Copy of the selected), Remove; then `PropertyPanel` with `layoutSourceOf("subtitle-style", <the text element's properties without text> + a Position group x / y)`, values `{ ...style.props, position }`, and a `createPropsLive` whose `commit` runs `updateStyle` and whose `preview` shows the patch live on every cue that follows (the preview module's live props, as the text editor uses them). A note: "Editing <name> changes its <n> cues at once."
  - Cue tab: the selected cues' style picker (`mark` with `styleId`), `PropertyPanel` over the text element's properties with the first cue's values and a `createPropsLive` committing `element.setProps` to every selected cue, Reset all to style (`resetToStyle`), New style from this cue (`addStyle` `fromClipId`), Remove from subtitles (`unmark`).
  - `OwnValueAction` (`fieldActions`, applies to text fields of a marked clip): ◆ and Reset to style when the path is in `ownPaths`; it shows in the editor's inspector too.
  - Edit page (`subtitle.menu.ts`, `clipActions` without `scopes` plus `"subtitle"` for the menu): `CueBadge` "CC" in the style's color on marked clips; menu entries for text clips: **Mark as subtitle** (unmarked), **Subtitle style ▸** (the composition's styles) and **Remove from subtitles** (marked).
- [ ] **Step 2:** `pnpm typecheck && pnpm lint && pnpm test`; live: edit Default's size (cues follow, a cue with its own color keeps it), switch Background off (its fields disabled), reset one value, mark/unmark in Edit. **Step 3:** README. **Step 4: Commit** `feat(subtitle): style and cue panels, badge and clip menu`.

---

### Task 9: Docs and the live check

**Files:** Modify `CLAUDE.md` (v1 scope gains "subtitles marked on text clips, with styles, the Subtitles page and `.srt` in and out"; module list gains `subtitle/`; point list unchanged), `docs/modules.md` (tier table), `CHANGELOG.md`, `CHANGELOG.es.md` (Unreleased), `subtitle/README.md` (final pass).

- [ ] **Step 1:** Write the docs. **Step 2:** Prune: keep only the tests of Tasks 1, 3 and 4 that guard integrity and commands (memory: prune tests after work). **Step 3:** With the app running, drive it once over MCP (`subtitle_import`, `subtitle_update_style`, `subtitle_to_srt`, `project_get_state`) and undo each. **Step 4:** `pnpm typecheck && pnpm lint && pnpm test`, `cargo clippy --all-targets -- -D warnings && cargo test`. **Step 5: Commit** `docs(subtitle): readme, changelog and scope`.
