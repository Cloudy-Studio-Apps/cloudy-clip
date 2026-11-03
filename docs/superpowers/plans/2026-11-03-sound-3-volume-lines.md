# Sound, Stage 3: Volume Lines and Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Volume drawn on the timeline: a line over each clip that edits its existing volume keys, and a track automation line written by hand or by moving the fader while playing.

**Architecture:** The clip line is a view of `sound.volumeDb` keys and changes them through `keyframe.*` commands, so preview, export and the Curves dock already agree. The track line is a `KeyTrack` in `TrackMix.volumeLine`, its keys on timeline time, so `trackValue`, `keyMoments`, `envelope.ts` and `envelope_expr` evaluate and export it with no new code.

## Reuse

- `KeyTrack`, `Keyframe` and `trackValue` (`project/logic/animate.ts`): the track line's type and evaluator. Eases work on it as on clip keys.
- `writeKey`, `moveTrackKeys`, `withoutKeys` (`project/logic/keys.ts`): the track line's commands are thin wrappers over them, so editing a track line and editing clip keys share every rule.
- `keyMoments` and `envelope` (`export/logic/envelope.ts`), `envelope_expr` and the gain envelope filter (`export/soundfilters.rs`): export.
- `envelope`'s dropping of points within a tolerance: thinning a drawn stroke is a call to the same function, extracted as `simplify(points, tolerance)` in `envelope.ts` and used by both.
- The clip line's points are drawn with `keyframe`'s diamond and the timeline's `timeToPx`.

**Tech Stack:** TypeScript, React 19, Zod, Web Audio `AudioParam` automation, Vitest, Rust.

**Spec:** `docs/superpowers/specs/2026-11-02-sound-page-design.md`, "Keyframes (stage 3)". Requires Stage 1. The `keyframe` module exists.

## Global Constraints

- `CLAUDE.md` rules apply. Done means the TypeScript and Rust checks pass. Commits carry no `Co-Authored-By` line.
- A track line is a `KeyTrack` with `blend: "number"`, `min: -60`, `max: 12`; its keys' `t` is timeline time. Linear between keys unless a key has an ease, holds before the first and after the last, and lives on timeline time: moving or splitting a clip never moves it.
- With a track line, the fader is an offset in dB on top of it.
- Automation modes per track: Read, Touch, Latch; view state, not in history. One pass while playing is one undo step, sent on stop.
- Drawn strokes are thinned to points within 0.5 dB of the stroke.
- Tests: the commands named below and `simplify`; evaluation is `trackValue`'s, already tested.

## Review Focus

1. **A clip moved under a track line:** the line stays put, the clip's own keys move with it. Tested in Task 2.
2. **Touch released mid-pass:** the line after the release is unchanged. Tested in Task 4.
3. **A pass stopped by switching page or composition:** what was written is sent once, not lost or doubled. Checked in Task 4.
4. **A long line (an hour, a point every second):** export still builds, through the graph file. Tested in Task 3.
5. **A clip line on a clip with speed:** points sit where the sound is, because keys are on content time. Checked in Task 1.

## File Tree

```
src/modules/
  project/
    ~ project.types.ts                          TrackMix.volumeLine: KeyTrack
    ~ logic/mix.ts, README.md
  sound/
    + sound.line.commands.ts                    setLine, addPoints, movePoints, removePoints, writePass
    + sound.line.commands.test.ts
    + ui/ClipVolumeLine.tsx, ui/clipline.gesture.ts    a clipActions badge, both scopes
    + ui/TrackVolumeLine.tsx, ui/trackline.gesture.ts  a timelineOverlay, both scopes
    + ui/automation.hook.ts                     Touch and Latch while playing
    ~ ui/SoundTransport.tsx                     Draw volume, automation mode
    ~ ui/MixerStrip.tsx                         mode button, offset shown
    ~ sound.store.ts, sound.module.ts, sound.mcp.ts, sound.types.ts, README.md
  preview/
    ~ engine/engine.mixbus.ts                   schedules the line on the bus gain
    ~ README.md
  export/
    ~ export.types.ts                           TrackMixSpec.gainEnvelope
    ~ logic/envelope.ts                         simplify, extracted from envelope
    + logic/envelope.test.ts                    simplify only
    ~ logic/mixdown.ts, logic/mixdown.test.ts
src-tauri/src/export/
  ~ mixgraph.rs                                 a track's volume through soundfilters' gain envelope
```

---

### Task 1: The clip volume line

**Files:** Create `ui/ClipVolumeLine.tsx`, `ui/clipline.gesture.ts`. Modify `sound.module.ts`, `sound/README.md`.

**Interfaces:** Consumes `keyframe.set`, `keyframe.move`, `keyframe.remove`, `timeOfContent`, `contentTime` from `project`. Produces a `clipActions` badge `sound.clipLine`, `scopes: ["all", "sound"]`, on clips of audio tracks.

- [ ] **Step 1:** Draw the clip's `sound.volumeDb` as a line (the static value when unkeyed) in `--on`, points as small diamonds. Dragging a point sends one `keyframe.move` or `keyframe.setValues` on release; double-click on the line sends `keyframe.set`; Delete on a selected point `keyframe.remove`. Feedback while dragging by `style` only.
- [ ] **Step 2:** Full checks; check on a clip with speed and on a split clip. Commit: `feat(sound): clip volume lines on the timeline`.

### Task 2: The track line in the document

**Files:** Create `sound.line.commands.ts`, `sound.line.commands.test.ts`. Modify `project.types.ts`, `logic/mix.ts`, `sound.mcp.ts`, READMEs.

**Interfaces:** `TrackMix.volumeLine?: KeyTrack`. Commands, each a wrapper over `project`'s key helpers: `sound.setLineKey { trackId; at; db; ease? }` (`writeKey`), `sound.moveLineKeys { trackId; keyIds; delta; deltaDb }` (`moveTrackKeys`), `sound.removeLineKeys` (`withoutKeys`; the last key removed drops the line), `sound.writePass { trackId; from; to; points: { at; db }[] }` (replaces the keys between `from` and `to`). Tools for each.

- [ ] **Step 1: Write the failing tests:** `trackValue` of a line holds before the first key and after the last (pins that reuse); moving a clip leaves `volumeLine` equal; `writePass` replaces only its span; a value out of range is refused.
- [ ] **Step 2:** Run them. Expected: FAIL. Implement until PASS.
- [ ] **Step 3:** Full checks. Commit: `feat(sound): track volume lines`.

### Task 3: The track line heard and exported

**Files:** Modify `engine.mixbus.ts`, `export.types.ts`, `mixdown.ts`, `mixdown.test.ts`, `mixgraph.rs`, READMEs.

**Interfaces:** Preview: while playing, the bus gain follows `trackValue(line, now)` plus the fader offset, scheduled with `linearRampToValueAtTime` a second ahead at the line's `keyMoments` and every 100 ms between eased keys, rescheduled on seek and on change. Export: `TrackMixSpec.gainEnvelope?: EnvelopePoint[]` from `envelope(t => dbToLinear(trackValue(line, t) + offset), from, to, keyMoments(line, from, to))`, the same call `keyedFields` makes for clips; `mixgraph.rs` uses `soundfilters`' gain envelope filter on the track.

- [ ] **Step 1: Write the failing tests:** `mixdown` gives a track with a line a `gainEnvelope` that starts at the export range, not at 0; Rust: a track with an envelope gets `volume='…':eval=frame` after its `amix`; a line of 3,600 points produces a graph that goes to the script file.
- [ ] **Step 2:** Run them. Expected: FAIL. Implement until PASS. Check by ear against a full play. Commit: `feat(sound): track volume lines in preview and export`.

### Task 4: Drawing and automation

**Files:** Create `ui/TrackVolumeLine.tsx`, `ui/trackline.gesture.ts`, `ui/automation.hook.ts`. Modify `export/logic/envelope.ts`, `envelope.test.ts`, `SoundTransport.tsx`, `MixerStrip.tsx`, `sound.store.ts`, `sound.types.ts`.

**Interfaces:** `simplify(points: EnvelopePoint[], tolerance: number): EnvelopePoint[]` extracted from `envelope()` in `envelope.ts`, which then calls it; strokes use it with 0.5 dB. `SoundViewState.automation: Record<TrackId, "read" | "touch" | "latch">` and `lineView: Record<TrackId, boolean>` (the track line in front). The track line is a `timelineOverlay` with `scopes: ["all", "sound"]`.

- [ ] **Step 1: Move first** (`refactor(export): simplify out of envelope`); `mixdown.test.ts`, which covers `envelope`, passes unchanged. Then write the failing tests: `simplify` keeps the first and last points, drops points within the tolerance of the line, keeps a corner.
- [ ] **Step 2:** Run. Expected: FAIL. Implement until PASS.
- [ ] **Step 3:** Draw volume: a drag over a lane draws on the track line when `lineView` is on, otherwise on the clip line; the stroke is thinned and sent as one `sound.writePass` or one `keyframe` batch.
- [ ] **Step 4:** Automation: in Touch, holding the fader while playing records `{at, db}` each frame, and releasing stops the record; Latch keeps recording until stop. On stop (or page or composition change) one `sound.writePass` with the thinned points. Read plays the line only. A test: Touch released at 2 s of a pass from 0 to 4 s leaves the line after 2 s as it was.
- [ ] **Step 5:** Full checks. Update READMEs. Commit: `feat(sound): draw volume and fader automation`.
