# Sound, Stage 6: Quick Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Find beats, Strip silence and Match level: three tools that save time on common jobs.

**Architecture:** Detection is native: beats by onset detection over FFmpeg-decoded samples, silence by `silencedetect`, loudness by `ebur128`. Results for files are cached outside the project. The edits are ordinary undoable commands built from those results.

**Tech Stack:** TypeScript, React 19, Zod, Vitest, Rust (Tauri 2), FFmpeg.

**Spec:** `docs/superpowers/specs/2026-11-02-sound-page-design.md`, "Quick tools (stage 6)" and "The page changes sound, never the picture". Requires Stage 1.

## Global Constraints

- `CLAUDE.md` rules apply; TypeScript and Rust checks pass; commits carry no `Co-Authored-By` line.
- On the Sound page Strip silence cuts sound only and leaves gaps (linked clips unlinked as in Stage 1). On Edit it's in the clip menu and on a video it's a jump cut: both cut, gaps closed.
- Strip silence and Match level show what they will do before they do it, and are one undo step each.
- Beats are cached per file, not in history. Snapping uses them; nothing is placed by itself.

## Review Focus

1. **Strip silence on Edit with other tracks after the clip:** the preview warns which tracks would drift before closing gaps. Checked in Task 2.
2. **A file with no beats** (speech): no ticks, no error. Tested in Task 1.
3. **Match level on clips with keyed volume:** the keys shift by the same offset, the curve's shape stays. Tested in Task 3.
4. **Strip silence threshold so low nothing is found:** the preview says so and nothing is sent. Checked in Task 2.
5. **A speed-changed clip:** silence is found in file time and mapped to the timeline through `timeOfContent`. Tested in Task 2.

## File Tree

```
src/modules/
  sound/
    + sound.tools.commands.ts                   stripSilence, matchLevel
    + sound.tools.commands.test.ts
    + logic/silence.ts, logic/silence.test.ts   silent stretches to cuts
    + sound.beats.store.ts                      beats per file
    + ui/lanes/BeatTicks.tsx                    a timelineOverlay, both scopes
    + ui/transport/StripSilenceDialog.tsx, ui/transport/MatchLevelDialog.tsx
    + sound.menu.ts                             Strip silence in the clip menu on Edit
    ~ ui/transport/QuickTools.tsx, sound.module.ts, sound.mcp.ts, README.md
    ~ ui/soon/soon.catalog.ts                   loses this stage's entries (the folder goes when it is empty)
src-tauri/src/sound/
  + beats.rs                                    onset detection
  ~ analyze.rs                                  silencedetect, per-clip loudness
  ~ commands.rs                                 sound_beats, sound_silences, sound_clip_loudness
```

## Reuse

- Snapping already takes module targets through `timelineSnapTargets` (added by the markers project, `timeline/ui/snap.hook.ts`). Beats are one more contribution to it; nothing new in the timeline.
- Strip silence runs `timeline.splitAt` and `timeline.deleteClips` (or `timeline.rippleDelete` with gaps closed) nested, with `soundOnly` from Stage 1, so linked clips, junctions and undo follow the timeline's own rules.
- Match level writes through `audio.setSound`, and offsets keyed volume with `keyframe.setValues`.
- The native analysis reuses Stage 5's `sound/analyze.rs` and the mix graph; per-clip loudness is the same `ebur128` parse on one file.

---

### Task 1: Find beats

**Files:** Create `src-tauri/src/sound/beats.rs`, `sound.beats.store.ts`, `ui/lanes/BeatTicks.tsx`. Modify `ui/transport/QuickTools.tsx`. Modify `sound/commands.rs`, `sound.module.ts`, READMEs.

**Interfaces:** Tauri `sound_beats({ path }) -> { beats: u64[] }` in file microseconds, cached by path and file size and mtime. `sound` contributes `sound.beats` to the existing `timelineSnapTargets` (`{ id; times(state, compositionId) }`).

- [ ] **Step 1: Write the failing Rust tests:** a synthetic click track at 120 BPM gives beats every 500 ms ±10 ms; a sine gives none.
- [ ] **Step 2:** Implement (spectral flux onsets, then a tempo estimate to drop strays) until PASS. Wire the ticks and snapping. Replace this task's placeholder with the working control: remove `transport.findBeats` from `ui/soon/soon.catalog.ts` and its `soon(…)` call in `ui/transport/QuickTools.tsx`. Commit: `feat(sound): find beats`.

### Task 2: Strip silence

**Files:** Create `logic/silence.ts`, `silence.test.ts`, `sound.tools.commands.ts`, `sound.tools.commands.test.ts`, `ui/transport/StripSilenceDialog.tsx`, `sound.menu.ts`. Modify `ui/transport/QuickTools.tsx`, Modify `analyze.rs`, `sound/commands.rs`.

**Interfaces:** Tauri `sound_silences({ path, from, to, thresholdDb, minMs }) -> { stretches: [u64, u64][] }`. `cutsFor(clip, stretches, padMs): Cut[]` in timeline time. Command `sound.stripSilence { clipIds; thresholdDb; minMs; padMs; closeGaps }`; with `soundOnly` on the Sound page.

- [ ] **Step 1: Write the failing tests:** stretches shorter than `minMs` are kept; padding keeps `padMs` of quiet each side; a clip at 2× maps stretches through `timeOfContent`; with `closeGaps` the clips after move left by the removed time; on the Sound page a linked clip's picture is untouched.
- [ ] **Step 2:** Implement until PASS. The dialog previews the cuts on the lane, names tracks that would drift, and sends one command. Replace this task's placeholder: remove `transport.stripSilence` from `ui/soon/soon.catalog.ts` and its `soon(…)` call in `ui/transport/QuickTools.tsx`. Commit: `feat(sound): strip silence`.

### Task 3: Match level

**Files:** Modify `sound.tools.commands.ts`, its test, `analyze.rs`, `sound/commands.rs`. Create `ui/transport/MatchLevelDialog.tsx`. Modify `ui/transport/QuickTools.tsx`.

**Interfaces:** Tauri `sound_clip_loudness({ path, from, to }) -> Option<f64>`. Command `sound.matchLevel { clipIds; targetLufs? }`: target defaults to the loudest selected clip.

- [ ] **Step 1: Write the failing tests:** two clips at −20 and −26 LUFS with no target end with `volumeDb` differing by 6; a clip with volume keys gets all keys offset by the same dB.
- [ ] **Step 2:** Implement until PASS.
- [ ] **Step 3: Replace this stage's last placeholder** and remove `transport.matchLevel` from `ui/soon/soon.catalog.ts`, with its `soon(…)` call. When the catalog is empty, delete `ui/soon/` (`soon.props.ts`, `soon.catalog.ts`, `index.ts`), `SoonEntry` and `SoonId` in `sound.types.ts`, and the README's Placeholders paragraph. Commit: `feat(sound): match level`.
