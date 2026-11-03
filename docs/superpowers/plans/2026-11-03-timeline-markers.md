# Timeline markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colored, noted markers on a composition's ruler that clips, trims and the playhead snap to, editable by the user and by agents, saved and undoable.

**Architecture:** Markers are a top-level record of the project document (`ProjectState.markers`), so each marker undoes on its own. A new feature module `marker` owns the commands, MCP tools, keybindings, ruler flags and editor. The timeline gains one point, `timelineSnapTargets`, which the marker module fills; the timeline never names markers.

**Tech Stack:** TypeScript (strict), React 19, Zustand + Immer, Zod, Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-11-03-timeline-markers-design.md`

## Global Constraints

- Times are integer microseconds (`Micros`); a marker added at the playhead lands on the frame the playhead shows (`Math.floor(t / frame) * frame` with `frameDuration(format)`).
- Ids come from `createId("marker")`.
- Commands: `marker.add`, `marker.update`, `marker.remove`; all `undoable: true`, Zod input, `CommandFailure("marker.<reason>", …)`.
- MCP tools: `marker_add`, `marker_update`, `marker_remove` (`commandTool`), `marker_list`.
- Keys: `m` adds, `shift+m` next, `mod+shift+m` previous.
- Colors, by name: `orange #e8772e`, `yellow #e3bd2f`, `green #6f9a3a`, `blue #5f9fd6`, `purple #8f7ac8`, `pink #d4488f`. Default `blue`; a new marker takes the last color picked.
- No React state on per-frame paths (rule 24); flags never re-render on playhead movement.
- Sharp shapes (`rounded-xs`..`rounded-lg`), semantic tokens for chrome; marker hexes only for the flag itself.
- Commits: no Co-Authored-By lines.

## Review Focus

1. A marker past the composition's end (agent passes a large time, or the composition is shortened): kept, still drawn and listed; adding past the end is allowed, only negative times fail.
2. Deleting a composition with markers: its markers go in the same undo step, and undo brings them back.
3. Undo out of order: an agent's marker stays undoable after the user adds or edits a different marker.
4. Keys while typing in the note field: `m` types an "m", it does not add a marker (keybinding host already skips inputs; verify by hand).
5. Two markers at the same time: both drawn, both listed, next/previous skips past the shared time instead of sticking.

## Files

```
Create
  src/modules/marker/index.ts
  src/modules/marker/marker.ref.ts
  src/modules/marker/marker.module.ts
  src/modules/marker/marker.types.ts
  src/modules/marker/marker.commands.ts
  src/modules/marker/marker.commands.test.ts
  src/modules/marker/marker.mcp.ts
  src/modules/marker/marker.keys.ts
  src/modules/marker/marker.store.ts
  src/modules/marker/README.md
  src/modules/marker/logic/markers.ts          colors, sorted list, next/previous
  src/modules/marker/ui/index.ts
  src/modules/marker/ui/MarkerFlags.tsx        the overlay: flags in the ruler
  src/modules/marker/ui/MarkerFlag.tsx         one flag
  src/modules/marker/ui/flag.gesture.ts        drag a flag
  src/modules/marker/ui/MarkerEditor.tsx       note + color popover
  src/modules/timeline/ui/snap.hook.ts         useSnapCandidates()
Modify
  src/modules/project/project.types.ts         Marker, MarkerId, MarkerColor, ProjectState.markers
  src/modules/project/project.store.ts         createEmptyProject: markers {}
  src/modules/project/logic/fields.ts          RECORDS + validate
  src/modules/project/project.mcp.ts           markers per composition
  src/modules/project/index.ts, README.md
  src/modules/project/logic/fields.test.ts     (literal) + marker undo test
  src/modules/composition/composition.library.commands.ts   delete drops markers
  src/modules/composition/logic/clone.ts       duplicate copies markers
  src/modules/composition/composition.commands.test.ts      (literal) + cascade test
  src/modules/composition/README.md
  src/modules/workspace/logic/format.ts        markers schema, default {}
  src/modules/timeline/timeline.points.ts, timeline.types.ts, index.ts, README.md
  src/modules/timeline/ui/Ruler.tsx            scrub snaps; Ctrl turns it off
  src/modules/timeline/ui/TrackLane.tsx, TimelineClip.tsx, clip.gesture.ts   use the hook
  src/modules/preview/logic/frame.test.ts, src/modules/project/logic/compositions.test.ts  (literals)
  src/app/bootstrap.ts                         list markerModule
  CLAUDE.md                                    marker in Where to look; timeline reads timelineSnapTargets
```

---

### Task 1: Markers in the project document

**Interfaces — Produces:**

- `type MarkerId = string`; `type MarkerColor = "orange"|"yellow"|"green"|"blue"|"purple"|"pink"`; `const MARKER_COLORS: readonly MarkerColor[]`
- `interface Marker { id: MarkerId; compositionId: CompositionId; time: Micros; note: string; color: MarkerColor }`
- `ProjectState.markers: Record<MarkerId, Marker>`
- `compositionMarkers(state, compositionId): Marker[]` (by time, then id) exported from `@/modules/project`

- [ ] Add a failing test in `fields.test.ts` "markers undo on their own": actor A adds marker m1, actor B adds m2 then edits m2's note; A's undo of m1 succeeds and m2 stays.
- [ ] Add a failing test in `composition.commands.test.ts` "deleting a composition takes its markers": delete removes markers of that composition only; undo restores them; duplicate copies them with new ids and the copy's `compositionId`.
- [ ] Implement: types, empty project, `"markers"` in `RECORDS`, validate `"a marker would be left without its composition"`, delete/clone, `format.ts` record with `.default({})`, `project_get_state` lists `markers: compositionMarkers(state, id)` per composition (update its description). Fix ProjectState literals.
- [ ] `pnpm typecheck && pnpm vitest run src/modules/project src/modules/composition src/modules/workspace` passes.
- [ ] Commit `feat(project): markers in the document`.

### Task 2: Snap targets point, ruler scrub snapping

**Interfaces — Produces:**

- `interface TimelineSnapTarget { id: string; times(state: ProjectState, compositionId: CompositionId): readonly Micros[] }`, point `timelineSnapTargets` exported from `@/modules/timeline`.
- `useSnapCandidates(): (state, compositionId, playhead, ignore?) => Micros[]` in `timeline/ui/snap.hook.ts` = `snapCandidates(...)` plus every target's times.

- [ ] Add point + type; hook reads it with `usePoint`.
- [ ] `TrackLane`, `TimelineClip` (passes `candidates` builder into `clip.gesture` options) and `Ruler` use it. Ruler scrub: `snapTime(t, candidates, pxToTime(SNAP_PX))` unless `ctrlKey || metaKey`; candidates gathered once on pointer-down, with the playhead excluded (it is what moves).
- [ ] `pnpm typecheck && pnpm vitest run src/modules/timeline` passes. No new test (thin wiring).
- [ ] Commit `feat(timeline): snap targets from modules; the ruler scrub snaps`.

### Task 3: The marker module: commands, tools, keys

**Interfaces — Produces:**

- `addMarker` input `{ compositionId?, time?: int>=0, note?: string (default ""), color?: MarkerColor }` → `{ markerId }`. No `compositionId` = caller's open composition; no `time` = caller's playhead floored to a frame.
- `updateMarker` input `{ markerId, time?, note?, color? }`; at least one field, else `marker.nothing`. Unknown id: `marker.not_found`.
- `removeMarker` input `{ markerIds: string[] (min 1) }`; any unknown id fails the whole command.
- `marker_list` tool `{ compositionId? }` → markers by time.
- `logic/markers.ts`: `MARKER_HEX: Record<MarkerColor,string>`, `nextMarkerTime(markers, t): Micros | null` (first time > t), `previousMarkerTime(markers, t)` (last time < t).
- `marker.store.ts`: `createMarkerUi()` → Zustand store `{ lastColor: MarkerColor; editing: MarkerId | null }`.
- `MarkerApi { ui: StoreApi<MarkerUiState> }`.

- [ ] Failing tests in `marker.commands.test.ts`: add at the playhead floors to the frame; add without an open composition fails `composition.none_open`; update with no fields fails `marker.nothing`; remove with an unknown id changes nothing; one undo reverts one add.
- [ ] Implement commands, `nextMarkerTime`/`previousMarkerTime`, MCP tools, keybindings (`m` → add with `lastColor`; `shift+m`/`mod+shift+m` → `preview.seek` to the next/previous time of the user's open composition, `null` when none), module wiring (`tier: "feature"`, `requires: ["project", "timeline", "preview"]`), bootstrap, README.
- [ ] `pnpm typecheck && pnpm vitest run src/modules/marker` passes.
- [ ] Commit `feat(marker): commands, agent tools and keys`.

### Task 4: Flags in the ruler

- [ ] `MarkerFlags` (contributed to `timelineOverlays`) draws the open composition's markers: a small flag in the ruler at `headerWidth + timeToPx(time)`, colored by `MARKER_HEX`, `title` = note; skips flags outside the visible window is not needed (markers are few).
- [ ] `flag.gesture.ts`: drag moves the flag via `style.left`, snaps to frames and to `useSnapCandidates` targets (excluding itself), sends one `marker.update` on release; a click without movement seeks to the marker.
- [ ] Double-click opens `MarkerEditor` (note input, six swatches; Enter or blur saves, Escape cancels; picking a color sets `lastColor`). Right-click removes the marker.
- [ ] Marker module contributes `timelineSnapTargets` with the composition's marker times.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass; check in the running app (`pnpm tauri dev`) or by the MCP tools.
- [ ] Commit `feat(marker): flags in the ruler`.

### Task 5: Docs, prune, full check

- [ ] CLAUDE.md: `marker/` in Where to look; timeline reads `timelineSnapTargets` (rule 13). READMEs of project, composition, timeline, marker updated.
- [ ] Prune tests to the ones rule 3 keeps (document integrity: undo independence, cascade; marker commands' validation).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass.
- [ ] Commit `docs: markers`.
