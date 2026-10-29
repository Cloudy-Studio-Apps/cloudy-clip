# Junctions and Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add junctions (things that sit on the cut between two touching clips, drawn as a glass
chip) as a core module, and pre-made CapCut-style transitions as the first junction kind, in a
`transition` feature module with its own tab.

**Architecture:** Junction data and its structural rules live in `project`; a new core
`junction` module owns kinds (a point), the registry, the generic commands and MCP tools;
`timeline` keeps junctions valid in every clip edit and draws the chips; `preview` mixes the two
clips of a junction through the kind's `mix`; the `transition` feature contributes the
`transition` kind, a preset point and catalog, the Transitions tab and its tools.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), React 19, Zustand + Immer, Zod,
Vitest (node env), Canvas 2D, Tauri 2 (WebKitGTK on Linux).

**Spec:** `docs/superpowers/specs/2026-10-29-junctions-transitions-design.md` (read it first; rule
numbers below are the spec's "Settled calls").

## Global Constraints

- All rules in `CLAUDE.md` apply; in particular: public entry points only (`@/core`, `@/ui`,
  `@/modules/<name>`), dotted file names, every type in a `.types.ts`, TSDoc on every export of an
  `index.ts`, every command and every MCP tool, logic in `logic/` with a test next to it.
- Done means `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. Each task ends with that.
- Times are integer `Micros`. Ids come from `createId("junction")`.
- Every change is a command through the bus; commands validate everything before `ctx.mutate`;
  expected errors are `CommandFailure("<module>.<reason>", message)`.
- Default transition duration **500_000 µs**; maximum **half the shorter of the two clips**;
  minimum **one frame** (`Math.ceil(1_000_000 / fps)`).
- No `kind === "transition"` (or any kind check) outside the module that owns the kind.
- Offscreen canvases for mixing are default 2D canvases: **never** `willReadFrequently`; never
  `getImageData` on video.
- No React state on per-frame paths (chip drag feedback, preview mixing).
- Each module's `README.md` is updated in the task that changes the module (README template in
  `docs/modules.md`).
- Do not add `Co-Authored-By` lines to commits (user preference).

## Review Focus

1. **A split clip with a transition between its halves** (same file on both sides): both halves
   must play at once during the overlap without black frames or a stall — Task 8 tests the
   engine's per-clip slot assignment and preload window for this case.
2. **Undo after adding a transition**: one undo restores every shifted clip (picture, linked
   sound, later clips) and removes the junction — Task 5 test `add then undo restores layout`.
3. **Adding a transition when an unlinked clip on an audio track is in the way of a shifting
   partner**: the command fails with `junction.overlap` and nothing moves — Task 5 test.
4. **Dragging a joined clip by one frame** (still overlapping): the junction's duration follows
   the new overlap; past the limit the move is refused — Task 6 tests.
5. **A project with a junction whose kind isn't registered** (transition module not loaded): the
   chip shows the id with "not available", the preview draws the right clip over the left, nothing
   throws — Task 3 registry test and Task 7 chip test.

---

### Task 1: Spike — blur and channel tricks on WebKitGTK (throwaway)

**Files:** none committed (a scratch file in the scratchpad or a devtools snippet).

- [ ] **Step 1:** Run `pnpm tauri dev`, import a 1080×1920 video, and in the webview devtools
      console run a snippet that, every animation frame for 5 s, draws the playing `<video>` into
      two offscreen `document.createElement("canvas")` 2D contexts (default options), then
      composites them onto a third with (a) `ctx.filter = "blur(12px)"`, (b) four offset
      `drawImage` passes at `globalAlpha 0.25` (smear), (c) `globalCompositeOperation =
"lighter"` with red/blue tinted copies offset by 8 px (channel split), (d) 12 horizontal slice
      redraws with random x offsets. Log the average ms per frame for each.
- [ ] **Step 2:** Record in the PR description / task notes: whether `ctx.filter` blurs at all on
      WebKitGTK, and ms per frame for (a)–(d). Decision rule: a technique is usable while playing
      if it costs **≤ 6 ms** per frame at 1080×1920; otherwise Woosh uses (b) and Glitch uses
      (c)+(d) without (a). Write the outcome as a one-line comment at the top of
      `woosh.ts` / `glitch.ts` in Task 11.

### Task 2: Project — junction data, structural rules, links move

**Files:**

- Modify: `src/modules/project/project.types.ts` (types `JunctionId`, `Junction`, `ClipMove`,
  `LayoutConflict`; `ProjectState.junctions`)
- Modify: `src/modules/project/project.store.ts` (`junctions: {}` in `createEmptyProject`)
- Modify: `src/modules/project/project.mcp.ts` (`project_get_state` returns `junctions`, ordered
  by track then time)
- Create: `src/modules/project/logic/links.ts` (moved from `src/modules/timeline/logic/links.ts`:
  `partnersOf`, `withPartners`; `selectionSubject` stays in timeline and imports them)
- Create: `src/modules/project/logic/junctions.ts`, `src/modules/project/logic/junctions.test.ts`
- Move test: `src/modules/timeline/logic/links.test.ts` → split: partner tests to
  `src/modules/project/logic/links.test.ts`, `selectionSubject` tests stay
- Modify: `src/modules/project/index.ts`, `src/modules/project/README.md`

**Interfaces — Produces:**

```ts
// project.types.ts
export type JunctionId = string;
/** Something on the cut between two adjacent clips of one track (spec rule 1). */
export interface Junction {
  id: JunctionId;
  kind: string;
  trackId: TrackId;
  leftClipId: ClipId;
  rightClipId: ClipId;
  /** Overlap of the two clips; 0 for kinds that don't overlap. */
  duration: Micros;
  props: Record<string, unknown>;
}
export interface ClipMove { clipId: ClipId; start: Micros }
export interface LayoutConflict { clip: Clip; other: Clip }
// ProjectState gains: junctions: Record<JunctionId, Junction>;

// logic/links.ts
export function partnersOf(state: ProjectState, clipId: ClipId): Clip[];
export function withPartners(state: ProjectState, clipIds: readonly ClipId[]): ClipId[];

// logic/junctions.ts
/** The junction joining exactly these two clips (left, right), if any. */
export function junctionBetween(state: ProjectState, leftId: ClipId, rightId: ClipId): Junction | undefined;
/** Junctions that have this clip on either side. */
export function junctionsOfClip(state: ProjectState, clipId: ClipId): Junction[];
/**
 * How much `left` and `right` (same track, left.start < right.start) may overlap: the junction's
 * duration if one joins them, or, when each is linked to a side of a junction on another track
 * (spec rule 7: partner of left ↔ partner of right), that junction's duration; else 0.
 */
export function allowedOverlap(state: ProjectState, left: Clip, right: Clip): Micros;
/** Moves for `fromClipId`, every later clip on its track, and all their linked partners, by `delta`. */
export function rippleMoves(state: ProjectState, fromClipId: ClipId, delta: Micros): ClipMove[];
/** A copy of the state with the moves (and optional junction writes) applied; pure (immer `produce`). */
export function applyMoves(
  state: ProjectState,
  moves: readonly ClipMove[],
  junctions?: Readonly<Record<JunctionId, Junction | null>>,
): ProjectState;
/** First pair of clips on any track that overlaps by anything other than `allowedOverlap`, or starts < 0. */
export function findLayoutConflict(state: ProjectState): LayoutConflict | undefined;
/** Junctions whose clips are gone, on different tracks, or don't overlap by exactly `duration`. */
export function staleJunctions(state: ProjectState): JunctionId[];
```

- [ ] **Step 1: Write failing tests** in `logic/junctions.test.ts` (build states by hand with a
      `state()` fixture helper; `S = 1_000_000`):
  - `allowedOverlap returns the junction duration for the joined pair and 0 otherwise`
  - `allowedOverlap covers the linked sound pair of a picture junction` (A,B pictures joined with
    500_000; their partners a,b on an audio track → 500_000; an unlinked audio clip → 0)
  - `rippleMoves moves the clip, later clips on its track and their partners, not other tracks`
  - `findLayoutConflict accepts an overlap equal to the junction and rejects 1 µs more or less`
  - `findLayoutConflict reports a negative start`
  - `staleJunctions finds missing clips, different tracks, and wrong overlap`
  - `applyMoves keeps clipIds sorted by start and leaves the input untouched`
- [ ] **Step 2:** `pnpm vitest run src/modules/project/logic` — expect FAIL (missing module).
- [ ] **Step 3:** Implement the types and functions above; move `links.ts` (timeline imports it
      from `@/modules/project`; update `timeline/logic/links.ts` to keep only `selectionSubject`).
      `findLayoutConflict` walks each track's `clipIds` in order and compares each clip with the
      next one (`overlap = prev.end - next.start`; conflict when `overlap > 0 && overlap !==
allowedOverlap(...)`, or when a non-adjacent later clip still overlaps).
- [ ] **Step 4:** `pnpm vitest run src/modules/project src/modules/timeline` — PASS; then
      `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 5:** Update `project/README.md` (data, `logic/`, `project_get_state` lists junctions).
      Commit: `feat(project): junction data and structural layout rules`.

### Task 3: Junction module — kinds, registry, module wiring

**Files:**

- Create: `src/modules/junction/{index.ts, junction.ref.ts, junction.module.ts, junction.types.ts,
junction.points.ts, junction.registry.ts, junction.registry.test.ts, README.md}`
- Create: `src/modules/junction/logic/define.ts` (`defineJunctionKind`)
- Modify: `src/app/bootstrap.ts` (add `junctionModule`), `docs/modules.md` (tier table row)

**Interfaces — Produces:**

```ts
// junction.types.ts
export type OverlapRule =
  | false
  | { default: Micros; min(state: ProjectState): Micros; max(left: Clip, right: Clip): Micros };
export interface MixEnv {
  format: ProjectFormat;
  /** Canvas pixels per output pixel. */
  kx: number; ky: number;
  /** Deterministic random in [0, 1) seeded by the junction id (stable across frames). */
  random(): number;
  /** Seconds since the junction started (for animated grain). */
  elapsed: number;
}
/** Draws one frame of a junction onto `ctx` (full frame, identity transform, canvas pixels). */
export type MixFn = (
  ctx: CanvasRenderingContext2D,
  a: CanvasImageSource, b: CanvasImageSource,
  progress: number, props: Record<string, unknown>, env: MixEnv,
) => void;
export interface JunctionDisplay { label: string; icon: LucideIcon }
export interface JunctionKindDefinition {
  kind: string;
  name: string;
  icon: LucideIcon;
  /** Track kinds it may sit on (spec rule 13). */
  tracks: readonly TrackKind[];
  properties: PropertyTree;
  defaults(format: ProjectFormat): Record<string, unknown>;
  overlap: OverlapRule;
  /** Check/adjust a full value set (e.g. options against the chosen preset); throw CommandFailure. */
  normalize?(next: Record<string, unknown>, env: NormalizeEnv): Record<string, unknown>;
  mix?: MixFn;
  display?(props: Record<string, unknown>): Partial<JunctionDisplay>;
}
export interface ResolvedJunctionKind { definition: JunctionKindDefinition; schema: z.ZodObject }
export interface JunctionApi {
  get(kind: string): ResolvedJunctionKind | undefined;
  list(): readonly ResolvedJunctionKind[];
  /** Stored props over the kind's defaults ({} props when the kind is missing). */
  resolve(junction: Junction, format: ProjectFormat): Record<string, unknown>;
  /** Label and icon for the chip; a missing kind gives `{ label: "<kind> (not available)" }`. */
  display(junction: Junction, format: ProjectFormat): JunctionDisplay & { missing: boolean };
  warn(message: string): void;
}
// junction.points.ts
export const junctionKinds: Point<JunctionKindDefinition>; // id "junction.kinds", keyed by kind
```

`schema` is built with `patchSchema` from `@/modules/element` (same rules as elements; custom prop
types from `propTypes`). Values are merged/minimized with the element helpers (`mergeProps`,
`resolveProps`, `minimizeProps`); export any of those not yet public from `element/index.ts`
(rule 7: export, don't reach in).

- [ ] **Step 1: Failing tests** `junction.registry.test.ts` (kernel with `project`, `element`,
      `junction`, a test kind contributed in a tiny test module):
  - `get returns a contributed kind with its patch schema`
  - `resolve merges stored props over defaults`
  - `display of an unregistered kind says not available and warns once`
  - `cache is rebuilt when a kind is contributed after load`
- [ ] **Step 2:** run, expect FAIL.
- [ ] **Step 3:** Implement following `element.registry.ts`'s shape (cache per point change, warn
      once). Module: tier `core`, requires `project`, `element`; `setup` creates the registry,
      `ctx.onDispose(registry.dispose)`, returns `{ api }`.
- [ ] **Step 4:** run tests PASS; full `typecheck/lint/test`.
- [ ] **Step 5:** README (template), `docs/modules.md` row. Commit
      `feat(junction): junction kinds, registry and module`.

### Task 4: Junction logic — limits and cuts

**Files:** Create `src/modules/junction/logic/{limits.ts, limits.test.ts, cut.ts, cut.test.ts}`

**Interfaces — Produces:**

```ts
// limits.ts
export interface DurationLimits { min: Micros; max: Micros; default: Micros } // in junction.types.ts
/** Limits for a kind between two clips; `{0,0,0}` when the kind doesn't overlap. max ≥ min or the cut can't take it. */
export function durationLimits(kind: JunctionKindDefinition, state: ProjectState, left: Clip, right: Clip): DurationLimits;
/** `d` clamped into the limits (for drags). */
export function clampDuration(d: Micros, limits: DurationLimits): Micros;
// cut.ts
export interface Cut { trackId: TrackId; left: Clip; right: Clip } // in junction.types.ts
/** The cut between two clips that touch, or overlap by their junction, nearest to `time` within `tolerance`. */
export function cutNear(state: ProjectState, trackId: TrackId, time: Micros, tolerance: Micros): Cut | undefined;
/** The cut at the end of a clip (its right neighbour touching it), if any. */
export function cutAfter(state: ProjectState, clipId: ClipId): Cut | undefined;
```

- [ ] **Step 1: Failing tests:** `limits: max is half the shorter clip` (4 s and 3 s → 1_500_000);
      `limits: min is one frame at 30 fps` (33_334); `limits: default 500_000 is clamped to max`
      (two 0.6 s clips → 300_000); `cutNear finds a touching pair and ignores a gap of 1 µs`;
      `cutNear finds an already-joined overlapping pair at its cut`; `cutAfter returns undefined
for the last clip`.
- [ ] **Step 2–4:** fail, implement, pass, full checks.
- [ ] **Step 5:** Commit `feat(junction): duration limits and cut lookup`.

### Task 5: Junction commands and MCP tools

**Files:** Create `src/modules/junction/{junction.commands.ts, junction.guards.ts, junction.mcp.ts,
junction.commands.test.ts}`; modify `junction.module.ts`, `index.ts`, `README.md`.

**Interfaces — Produces** (all `undoable: true` except describe):

```ts
// junction.add  — input: { kind: string; leftClipId?: string; rightClipId?: string;
//                          trackId?: string; at?: Micros; props?: Record<string, unknown>; duration?: Micros }
//   Cut = (leftClipId,rightClipId) or cutNear(trackId, at, one frame). Returns the Junction.
// junction.set  — input: { junctionIds: string[] (min 1); patch?: Record<string, unknown>; duration?: Micros }
// junction.remove — input: { junctionIds: string[] (min 1) }  → { removed: number }
export const addJunction, setJunction, removeJunction: CommandDefinition<…>;
// guards
export function requireJunction(state: ProjectState, id: string): Junction;  // junction.not_found
export function requireCut(state: ProjectState, input: {...}): Cut;          // junction.no_cut, junction.track_kind
// MCP: junction_add, junction_set, junction_remove (commandTool), junction_describe (defineMcpTool:
//   every kind: kind, name, tracks, overlap {default,min?,max rule text}, JSON schema of the patch, defaults)
```

Behavior (spec rules 1–9): validate everything first; for an overlapping kind, `delta = -d`
(`setJunction` with a new duration: `delta = old - new`; `removeJunction`: `delta = +old`), moves
= `rippleMoves(state, right.id, delta)`; `next = applyMoves(state, moves, { [id]: junction | null
})`; `findLayoutConflict(next)` → `junction.overlap` naming the clip in the way (reuse the message
shape of `timeline.overlap`); then one `ctx.mutate`. Errors: `junction.unknown_kind`,
`junction.not_found`, `junction.no_cut` (no touching pair), `junction.exists` (cut already has one
— `transition.apply` uses `set` instead), `junction.track_kind`, `junction.invalid_duration`
(message gives the allowed range in seconds), `junction.invalid_props` (via `parsePatch`-style
parse of the kind schema, then `normalize`).

- [ ] **Step 1: Failing tests** (kernel with fake media, a test overlapping kind and a test
      non-overlapping kind; two 4 s clips A [0,4s) and B [4s,8s) on V1 with linked sounds, a third
      clip C [8s,10s) on V1):
  - `add overlapping kind shifts B, C and their sounds 0.5 s earlier`
  - `add non-overlapping kind moves nothing`
  - `add then undo restores layout` (one undo: positions and `junctions` back exactly)
  - `add fails with junction.overlap when an unlinked audio clip blocks a shifting partner, and
changes nothing`
  - `add refuses a duration above half the shorter clip with junction.invalid_duration`
  - `add refuses a cut with a gap (junction.no_cut) and a second junction on a cut (junction.exists)`
  - `set duration 0.5 → 1 s shifts by another 0.5 s; remove shifts back`
  - `set patch validates against the kind schema`
  - `junction_describe lists kinds with their schema`
- [ ] **Step 2–4:** fail, implement, pass, full checks.
- [ ] **Step 5:** README command table. Commit `feat(junction): add, set, remove commands and tools`.

### Task 6: Timeline keeps junctions valid

**Files:** Modify `src/modules/timeline/{timeline.module.ts (requires junction),
timeline.clip.commands.ts, timeline.guards.ts, logic/placement.ts, logic/trim.ts, README.md}`;
create `src/modules/timeline/timeline.junctions.ts` (helpers the clip commands share, to keep
`timeline.clip.commands.ts` from growing; split it by topic if it passes ~200 lines more than it
is) and `timeline.junctions.test.ts`.

**Interfaces:**

- Consumes: Task 2 (`allowedOverlap`, `rippleMoves`, `applyMoves`, `findLayoutConflict`,
  `staleJunctions`, `junctionsOfClip`), Task 4 (`durationLimits`), `JunctionApi.get`.
- Produces:
  - `findOverlap(state, trackId, start, duration, ignore?, self?: Clip)` — skips an `other` whose
    overlap with `self` equals `allowedOverlap` in the right order.
  - `neighbourBounds` treats a joined neighbour's bound as `its edge ± junction.duration`.
  - `snapCandidates` unchanged except it includes junction cut times.

Rules to implement (spec rules 2, 10, 11, 12):

- **move**: build `next` with `applyMoves`; then for each junction of a moved clip: both sides
  moved by the same delta → keep; still overlapping → set `duration` to the overlap if within
  `durationLimits` else fail `junction.invalid_duration`; touching or apart → remove. Then
  `findLayoutConflict(next)` → `timeline.overlap`. Result includes `removedJunctions: string[]`.
- **trim** of a joined edge: the other side and everything after on that track (+ partners)
  ripple by the edge's change (`rippleMoves`); if the new lengths make `d > max`, set `d = max` in
  the same mutate (and ripple by that difference too).
- **split**: before the overlap on the left clip → re-point `leftClipId` to the right half; after
  the overlap on the right clip → keeps `rightClipId` (left half); inside an overlap →
  `junction.split_in_overlap` (when `clipIds` were given; when splitting "everything under the
  playhead", skip the clips whose overlap contains `at` and split the rest).
- **delete**: remove junctions of deleted clips, no shift.
- After every clip command: `staleJunctions(next)` must be empty (assert in tests).

- [ ] **Step 1: Failing tests** (`timeline.junctions.test.ts`, same fixture as Task 5):
  - `moving A and B together keeps the junction`
  - `nudging B right by one frame shrinks the junction by one frame`
  - `nudging B left past the limit is refused with junction.invalid_duration`
  - `moving B so it only touches A removes the junction`
  - `moving B away removes the junction and does not shift back`
  - `trimming A's end ripples B, C and sounds and keeps the overlap`
  - `trimming B shorter than 2·d shrinks d to the new max`
  - `splitting A before the overlap re-points the junction to the right half`
  - `splitting inside the overlap fails with junction.split_in_overlap`
  - `deleting A removes the junction and leaves B in place`
  - `existing timeline tests still pass` (run the whole timeline suite)
- [ ] **Step 2–4:** fail, implement, pass, full checks.
- [ ] **Step 5:** README rules section. Commit `feat(timeline): clip edits keep junctions valid`.

### Task 7: Timeline UI — chips, selection, duration drag, cut target

**Files:** Modify `src/modules/timeline/{timeline.types.ts, timeline.store.ts,
timeline.module.ts, index.ts, ui/TrackLane.tsx, ui/TimelinePanel.tsx, README.md}`; create
`ui/JunctionChip.tsx`, `ui/junction.gesture.ts`, `logic/cut.ts`, `logic/cut.test.ts`,
`junction.display.ts` (selector: chips per track per project change, one selector, like clip
display).

**Interfaces — Produces:**

```ts
// TimelineViewState gains: junctionSelection: JunctionId[]  (selecting a clip clears it and vice versa)
// TimelineApi gains:
selectJunction(id: JunctionId | null): void;
/** The cut under a screen point (within 8 px), for drops from other panels. */
cutTarget(clientX: number, clientY: number): Cut | null;
// logic/cut.ts
export function cutAtX(state: ProjectState, trackId: TrackId, x: number, pxPerSecond: number, tolerancePx: number): Cut | undefined;
```

- Chip: centered on the cut time (`right.start + d/2` for overlaps, the cut time otherwise),
  width `max(d · pxPerSecond, 28px)`, glass look with tokens only (`bg-foreground/10`,
  `backdrop-blur-sm`, `border-foreground/30`, `rounded-md`, `text-2xs`), icon + label from
  `JunctionApi.display`; a missing kind shows its label with `text-muted-foreground`. Rendered in
  the lane's virtualized pages (rule 25).
- `junction.gesture.ts`: edge drag updates the chip's `style.width/left` directly (rule 23),
  clamped with `clampDuration(durationLimits(...))`, one `junction.set { duration }` on release.
- Delete/Backspace with a junction selected runs `junction.remove`.

- [ ] **Step 1: Failing tests** `logic/cut.test.ts`: `cutAtX finds the cut within tolerance`,
      `cutAtX ignores gaps`; a view test `selecting a junction clears the clip selection`.
- [ ] **Step 2–4:** fail, implement, pass, full checks.
- [ ] **Step 5:** Manual check in `pnpm tauri dev` with the test kind or after Task 10: chip shows,
      drags, deletes, undo. README. Commit `feat(timeline): junction chips, selection, duration drag`.

### Task 8: Preview — overlapping clips and the mixing hook

**Files:** Modify `src/modules/preview/{preview.module.ts (requires junction),
engine/engine.types.ts, engine/engine.html.ts, engine/engine.slots.ts, README.md}`; create
`engine/engine.mix.ts`, `engine/engine.audio.ts`, `logic/junctions.ts`, `logic/junctions.test.ts`
(preview gets a `logic/` folder).

**Interfaces:**

```ts
// logic/junctions.ts
export interface ActiveJunction { junction: Junction; progress: number; elapsed: number } // preview.types.ts
/** Overlapping junctions under `time` on a track: progress = (time - right.start) / duration. */
export function activeJunctions(project: ProjectState, trackId: TrackId, time: Micros): ActiveJunction[];
/** Volume factors (0..1) for the left and right sound clips under a junction (equal-power). */
export function crossfadeGains(progress: number): { left: number; right: number };
// engine.types.ts: EngineOptions gains `junctions: Pick<JunctionApi, "get" | "resolve">`
// engine.mix.ts
export class MixCanvases { /** two pooled full-frame canvases sized like the main one */ a(): CanvasRenderingContext2D; b(): CanvasRenderingContext2D; dispose(): void }
```

Engine behavior: per video track, active clips may be two (left and right of an overlap). Draw
each into `MixCanvases.a/b` with the normal placement path (media frame or element `draw`), then
`kind.mix(ctx, a.canvas, b.canvas, progress, props, env)` onto the main canvas at that track's
place in the bottom→top order; no `mix` (or missing kind) → draw the right clip over the left.
`settled` requires both frames (rule 21). The slot pool already assigns per clip id; make sure the
right clip of a junction is in `upcoming` from `right.start - PRELOAD_AHEAD` (it is, since its
start is earlier) and that a split's seamless reuse still happens when there's no junction. Audio:
`slot.element.volume = gain` for linked sound clips under a junction (`crossfadeGains`).

- [ ] **Step 1: Failing tests** `logic/junctions.test.ts`: `activeJunctions gives progress 0 at the
overlap start and 0.5 halfway`, `none outside the overlap`, `crossfadeGains is equal power
(left² + right² = 1) and 1/0 at the ends`.
- [ ] **Step 2–4:** fail, implement, pass, full checks.
- [ ] **Step 5:** Manual check (`pnpm tauri dev`, test kind with a simple alpha mix): two clips of
      the same file split with a junction play through the overlap with no black frame;
      `preview_capture_frame` mid-overlap shows both. README (engine section). Commit
      `feat(preview): mix the two clips of a junction`.

### Task 9: Inspector — junction panel

**Files:** Modify `src/modules/inspector/{inspector.module.ts (requires junction),
ui/InspectorPanel.tsx, README.md}`; create `ui/JunctionView.tsx`.

- `InspectorPanel` shows `JunctionView` when `junctionSelection` has one id.
- `JunctionView`: `InspectorHeader` with the junction's display; a Duration row (number in
  seconds, `junction.set { duration }`, limits from `durationLimits`); the kind's properties via
  the same `resolveLayout` + `renderItem` path `ElementPanel` uses, committing with
  `junction.set { junctionIds, patch }` instead of `element.setProps` (factor the shared part out
  of `ElementPanel` into a component that takes a `commit(patch)` callback rather than copying it);
  a Remove button (`junction.remove`).
- [ ] **Step 1:** Failing test for any extracted pure piece (if `ElementPanel`'s commit is made
      a parameter, a test that the junction path builds `{ junctionIds, patch }`).
- [ ] **Step 2–4:** fail, implement, pass, full checks; manual check after Task 10.
- [ ] **Step 5:** README. Commit `feat(inspector): panel for a selected junction`.

### Task 10: Transition module — kind, presets point, options, apply command

**Files:** Create `src/modules/transition/{index.ts, transition.ref.ts, transition.module.ts,
transition.types.ts, transition.points.ts, transition.kind.ts, transition.options.ts,
transition.apply.command.ts, transition.commands.ts, transition.mcp.ts,
transition.commands.test.ts, README.md}`; modify `src/app/bootstrap.ts`, `docs/modules.md`.

**Interfaces — Produces:**

```ts
// transition.types.ts
export interface TransitionPresetDefinition {
  id: string; name: string;
  category: "basic" | "overlay" | "blur" | "glitch" | (string & {});
  properties: PropertyTree;                       // the preset's options
  defaults(format: ProjectFormat): Record<string, unknown>;
  mix: MixFn;
  /** Optional faster thumbnail draw; defaults to `mix` over two sample pictures. */
  thumbnail?: MixFn;
}
export interface TransitionProps { preset: string; options: Record<string, unknown> }
export type TransitionApi = Record<string, never>;
// transition.points.ts
export const transitionPresets: Point<TransitionPresetDefinition>; // "transition.presets", keyed by id
export function defineTransitionPreset(def: TransitionPresetDefinition): TransitionPresetDefinition;
// transition.kind.ts — the junction kind "transition":
//   tracks ["video"], overlap { default: 500_000, min: one frame, max: half the shorter clip },
//   properties { preset: prop.string, options: prop.custom("transition-options") },
//   normalize: preset must be registered (transition.unknown_preset); options parsed with the
//   preset's schema; a changed preset drops the old options; display → the preset's name.
//   mix: looks up the preset and calls its mix with resolved options.
// transition.options.ts — definePropType({ name: "transition-options", schema: () => z.record(z.unknown()), control: "transition-options" })
// transition.apply — input { preset: string; leftClipId?; rightClipId?; trackId?; at?; clipId?; junctionId?; duration?; options? }
//   Target: junctionId, else the cut (left/right, or trackId+at, or cutAfter(clipId)).
//   Existing transition on that cut → nested junction.set { patch: { preset, options } } (keeps duration);
//   else nested junction.add { kind: "transition", ... }. One undo step. Returns the Junction.
// MCP: transition_apply (commandTool), transition_list_presets (id, name, category, options schema, defaults)
```

- [ ] **Step 1: Failing tests** (kernel with project, element, junction, timeline, fake media,
      transition, one test preset):
  - `apply on a cut adds a 0.5 s transition and shifts the right clip`
  - `apply on a cut that has one replaces the preset, drops old options, keeps the duration`
  - `apply with an unknown preset fails with transition.unknown_preset`
  - `apply with clipId uses the cut at the end of that clip`
  - `apply on an audio track fails with junction.track_kind`
  - `transition_list_presets lists the test preset with its options schema`
- [ ] **Step 2–4:** fail, implement, pass, full checks.
- [ ] **Step 5:** README, `docs/modules.md` row, bootstrap. Commit
      `feat(transition): the transition junction kind and apply command`.

### Task 11: The seven presets

**Files:** Create `src/modules/transition/presets/{presets.ts, fade.ts, crossDissolve.ts,
dissolve.ts, wipe.ts, glare.ts, woosh.ts, glitch.ts}` and `src/modules/transition/logic/{easing.ts,
easing.test.ts, noise.ts, noise.test.ts}`; modify `transition.module.ts` (contribute
`builtInPresets`).

| id              | name           | category | options (defaults)                                            | look                                                                                                   |
| --------------- | -------------- | -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `fade`          | Fade           | basic    | `color` `#000000`                                             | a → color by p=0.5, color → b after                                                                    |
| `cross-dissolve`| Cross dissolve | basic    | —                                                             | a, then b at `globalAlpha = ease(p)`                                                                    |
| `dissolve`      | Dissolve       | basic    | `grain` 0..1 (0.5)                                            | b revealed through a seeded block mask whose threshold = p (block size from `grain`)                    |
| `wipe`          | Left to right  | basic    | `direction` left/right/up/down (`right`), `softness` 0..1 (0.3) | b over a through a moving linear-gradient mask (`destination-in` on canvas b)                            |
| `glare`         | Glare          | overlay  | `color` `#ffffff`                                             | cut at p=0.5 under a radial `lighter` flash peaking at 0.5, with a diagonal streak sweeping across      |
| `woosh`         | Woosh          | blur     | `direction` left/right (`left`)                               | a slides out / b slides in with ease-in-out; motion blur per Task 1's result                             |
| `glitch`        | Glitch         | glitch   | `intensity` 0..1 (0.6)                                        | cut at p=0.5; around it, seeded slice offsets + red/blue `lighter` split per Task 1's result             |

```ts
// logic/easing.ts
export function easeInOutCubic(t: number): number;  export function bump(t: number): number; // 0→1→0, peak at 0.5
// logic/noise.ts
export function seededRandom(seed: string): () => number;          // mulberry32 over a string hash
export function blockMask(width: number, height: number, block: number, seed: string): Float32Array; // per-block thresholds 0..1
```

- [ ] **Step 1: Failing tests:** `easeInOutCubic(0)=0, (0.5)=0.5, (1)=1`; `bump(0)=bump(1)=0,
bump(0.5)=1`; `seededRandom is deterministic per seed and differs across seeds`;
      `blockMask has one value per block and values in [0,1)`; for each preset: `defaults parse
with its own schema` (loop over `builtInPresets`).
- [ ] **Step 2–4:** fail, implement, pass, full checks. Mask presets draw the mask into canvas b
      with `destination-in` (no pixel reads).
- [ ] **Step 5:** Manual check of every preset in `pnpm tauri dev` while playing 1080×1920: no
      black frames, no visible stalls. Commit `feat(transition): seven built-in presets`.

### Task 12: The Transitions tab

**Files:** Create `src/modules/transition/ui/{index.ts, TransitionsPanel.tsx, PresetTile.tsx,
PresetThumbnail.tsx, preset.gesture.ts, thumbnail.hook.ts}`,
`src/modules/transition/transition.layout.ts` (tile size, thumbnail loop length); modify
`transition.module.ts` (panel `transition.panel`, slot `side`, title "Transitions", icon
`Blend` from lucide-react).

- Panel: heading + one section per category (Basic, Overlay, Blur, Glitch, then unknown
  categories by name), a grid of `PresetTile`s; follow `TextPanel`'s structure and
  `docs/prototype/`.
- `PresetThumbnail`: a small canvas that loops the preset's `thumbnail ?? mix` over two built-in
  sample pictures (two token-colored gradients with a shape) only while hovered, via
  `requestAnimationFrame` (no React state per frame); static frame at p=0.5 otherwise.
- Click: runs `transition.apply` with the selected junction, else `clipId` = the selected clip
  (cut after it); with neither, `notify("info", "Select a clip or a cut first")`.
- `preset.gesture.ts`: drag shows a DOM ghost; over the timeline, `timeline.cutTarget` highlights
  the cut (class on the lane, no renders); drop runs `transition.apply { leftClipId, rightClipId,
preset }`; drop elsewhere does nothing.
- [ ] **Step 1:** Failing test for any pure helper introduced (e.g. category ordering
      `orderCategories(presets)`), in `logic/categories.ts` + test.
- [ ] **Step 2–4:** fail, implement, pass, full checks.
- [ ] **Step 5:** Manual check: tab shows, hover animates, click and drag apply, undo works,
      an agent can do the same via `transition_apply`. README. Commit
      `feat(transition): the Transitions tab`.

### Task 13: Docs and final verification

**Files:** `CLAUDE.md` ("Where to look": `junction/`, `transition/`; scope line mentions
transitions), `docs/modules.md` (check both rows, `timeline`/`preview`/`inspector` requires),
`docs/architecture.md` if it lists modules.

- [ ] **Step 1:** Update the docs.
- [ ] **Step 2:** `pnpm typecheck && pnpm lint && pnpm test` — all pass.
- [ ] **Step 3:** End-to-end in `pnpm tauri dev`: import a video, split it, apply each preset to
      the cut, play, undo/redo, trim the joined edge, move a clip away, delete; then from an agent
      (`claude mcp add …`): `project_get_state` shows the junction, `transition_list_presets`,
      `transition_apply`, `junction_set`, `junction_remove`.
- [ ] **Step 4:** Commit `docs: junctions and transitions`.
