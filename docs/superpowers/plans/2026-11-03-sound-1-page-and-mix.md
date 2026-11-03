# Sound, Stage 1: The Page and the Mix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Sound page plays and edits sound: an audio-only timeline, a mixer with a fader, pan, mute, solo and meters per track, a pinned Master, live loudness, Mix A/B and monitor controls, and an export that sounds the same.

**Architecture:** The mix is data in `project` (`Track.mix`, `Composition.mix`), edited by `sound.*` commands. The preview sends every audio element through one Web Audio graph (clip chain, track bus, master, monitor) with meters and a loudness worklet. Export turns the same mix into a tree of `amix` stages in a new `mixgraph.rs`. The timeline takes a scope, so the Sound page shows audio tracks and only the contributions that opt in.

**Tech Stack:** TypeScript, React 19, Zustand, Immer, Zod, Web Audio (`AudioWorklet`, `AnalyserNode`), Vitest, Rust (Tauri 2), FFmpeg.

**Spec:** `docs/superpowers/specs/2026-11-02-sound-page-design.md`. Mockup: `docs/prototype/designs/sound-page.html`.

## Global Constraints

- `CLAUDE.md` rules apply to every task. Read the README of each folder you change first (rule 1), and update it in the same task.
- Done means `pnpm typecheck`, `pnpm lint` and `pnpm test` pass; Rust tasks also pass `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test`.
- Work on the current branch. Commits carry no `Co-Authored-By` line.
- All times are integer `Micros`. Volume in dB: `-60` to `12`. Pan: `-1` to `1`.
- A value equal to its default is never stored: an untouched track has no `mix`, an untouched composition no `mix`. The project file version stays `3`: the schema is loose and the fields are optional, so an older app keeps them on save.
- Solo and the monitor (Mono, Dim, speaker volume) are ephemeral and never reach an export.
- Only controls that work ship. Nothing from later stages appears, not even disabled.
- Colours come from tokens only (rule 34): meters use `--on` up to −6 dBFS, `--foreground` to −1, `--mark` above.
- Tests only where this plan names them (rule 3).

## Reuse

Nothing here is written twice (the spec's "Reuse" table). This stage:

- **Moves** the volume, pan and EQ band schemas from `audio.commands.ts` to `project/logic/sound.schema.ts` (Task 1), and generalizes `audio`'s private `stored()` into `project`'s `minimize(value, defaults)`, used by `audio.setSound` and `sound.setTrackMix` alike.
- **Moves** `setBand`, the stereo upmix and the panner out of `engine.audiograph.ts` into `engine/engine.soundnodes.ts` (Task 3). A clip chain and a track bus are both built from those parts; the bus is a chain without pitch and EQ until Stage 2.
- **Moves** `pan_gains`, `pan_filter`, the EQ filters, `compact`, `envelope_expr`, `stretch_tree`, the envelope filters and the tempo filters out of `recipe.rs` into `export/soundfilters.rs`, unchanged (Task 5). `recipe.rs` keeps segment assembly; `mixgraph.rs` uses `pan_filter` for a track's pan. Existing Rust tests move with their functions and pass unchanged.
- **Reuses** the inspector's Audio sections in the Clip tab, `audio.setSound` for fade handles, the timeline's `unlinkClips` nested for sound-only edits, and the kit's `EmptyState` and `SegmentedControl`.

## Review Focus

1. **A video's sound deleted on the Sound page:** the picture stays, and one undo brings the sound and its link back. Tested in Task 2.
2. **An old project opens:** a project with no `mix` anywhere exports the same filter graph per segment as before, with no `volume` or `pan` from the mix. Tested in Task 5.
3. **Switching Mix A to B and back:** returns exactly the values that were there; the first switch copies A. Tested in Task 1.
4. **An element that can't enter Web Audio:** it still plays and the user gets one `notify`, not silence. Checked by hand in Task 3.
5. **Loudness of a known signal:** a 1 kHz stereo sine at −23 dBFS reads −23.0 LUFS ±0.1. Tested in Task 4.

## File Tree

`+` is new, `~` is edited.

```
docs/
  ~ modules.md                                   sound row: requires, contributes
  + superpowers/plans/2026-11-03-sound-1-page-and-mix.md
src/
  app/
    ~ app.keybindings.ts                         plain keys on pages with keepsPlayback
  core/
    ~ README.md                                  page flags
    shell/
      ~ shell.types.ts                           AppPage.keepsPlayback, AppPage.timelineScope
  modules/
    project/
      ~ project.types.ts                         TrackMix, CompositionMix, MixSnapshot
      ~ project.selectors.ts                     trackMixOf, compositionMixOf
      + logic/mix.ts                             defaults, nestedSound
      + logic/sound.schema.ts                    volume, pan, EQ band schemas (moved)
      ~ logic/sound.ts                           minimize (from audio's stored)
      ~ index.ts, README.md
    sound/
      ~ sound.module.ts                          page flags, commands, tools, store
      ~ sound.ref.ts                             SOUND_PAGE
      ~ sound.types.ts                           SoundApi, SoundViewState, MonitorState
      ~ index.ts, README.md
      + sound.store.ts                           selected track, solo, expanded, monitor
      + sound.mix.commands.ts                    setTrackMix, resetTrackMix, setMaster, switchMix
      + sound.mix.commands.test.ts
      + sound.monitor.commands.ts                setSolo, setMonitor (not undoable)
      + sound.mcp.ts                             tools, sound_get_levels
      + logic/meter.ts                           dB to meter height, peak hold
      ~ ui/SoundPage.tsx                         the layout
      + ui/SoundTransport.tsx                    play, tools, Mix A/B, Mono, Dim, speaker
      + ui/MixerPanel.tsx                        header, scroller, pinned Master, Expand all
      + ui/MixerStrip.tsx                        one track
      + ui/MasterStrip.tsx
      + ui/Fader.tsx, ui/fader.gesture.ts
      + ui/PanSlider.tsx
      + ui/Meter.tsx, ui/meters.hook.ts          direct DOM writes
      + ui/SoundPanel.tsx                        Clip and Loudness tabs
      + ui/LoudnessTab.tsx, ui/LoudnessHistory.tsx
      + ui/index.ts
    preview/
      ~ preview.module.ts                        pauses only off pages that keep playback
      ~ preview.types.ts                         PreviewApi.sound: PreviewSound
      ~ preview.controller.ts                    passes the mix to the engine
      ~ engine/engine.types.ts                   SoundGraph grows buses
      ~ engine/engine.audiograph.ts              clip chains route to track buses
      ~ engine/engine.audio.ts                   every audio element in the graph
      ~ engine/engine.html.ts                    routes slots, updates buses
      + engine/engine.soundnodes.ts              setBand, upmix, panner (moved from audiograph)
      + engine/engine.mixbus.ts                  track bus, master, monitor
      + engine/engine.meters.ts                  analysers per bus
      + engine/loudness.worklet.ts
      + logic/loudness.ts, logic/loudness.test.ts
      ~ ui/index.ts, index.ts, README.md         export PreviewStage
    timeline/
      ~ timeline.types.ts                        TimelineScope; scopes on entries
      ~ timeline.module.ts                       keys pass soundOnly; Cut opts in
      ~ timeline.menu.ts                         scopes on entries
      ~ timeline.move.commands.ts                moveClip, trimClip take soundOnly
      ~ timeline.split.commands.ts               deleteClips takes soundOnly
      ~ timeline.commands.test.ts
      + logic/scope.ts                           inScope, activeScope
      ~ ui/TimelinePanel.tsx                     scope prop
      ~ ui/TimelineClip.tsx, ui/TimelineToolbar.tsx, ui/clip.gesture.ts
      ~ index.ts, README.md
    keyframe/
      ~ keyframe.module.ts                       tool, dock, badge in both scopes
    audio/
      ~ audio.commands.ts                        schemas and minimize from project
      ~ audio.module.ts                          menu and fade handles in both scopes
      ~ audio.menu.ts
      + ui/FadeHandles.tsx, ui/fade.gesture.ts
      ~ README.md                                the old invariant goes
    collab/
      ~ collab.module.ts                         playheads in both scopes
    inspector/
      + ui/ClipTabSections.tsx                   one tab of the selected clip
      ~ index.ts, README.md
    export/
      ~ export.types.ts                          SoundMix, TrackMixSpec, SoundSegment.track
      ~ export.commands.ts                       mix into the spec
      ~ logic/mixdown.ts                         segments per track, nested sound
      ~ logic/mixdown.test.ts
      ~ README.md
src-tauri/src/export/
  ~ recipe.rs                                    segment assembly; calls soundfilters and the mix graph
  ~ mod.rs                                       mod soundfilters, mod mixgraph
  + soundfilters.rs                              pan, EQ, envelope, tempo filters (moved, with their tests)
  + mixgraph.rs                                  tracks, master, and tests
```

---

### Task 1: The mix in the document, and its commands

**Files:** Create `src/modules/project/logic/mix.ts`, `project/logic/sound.schema.ts`, `src/modules/sound/sound.mix.commands.ts`, `sound.mix.commands.test.ts`, `sound.mcp.ts`. Modify `project.types.ts`, `project.selectors.ts`, `project/logic/sound.ts`, `project/index.ts`, `project/README.md`, `audio/audio.commands.ts`, `sound.module.ts`, `sound.types.ts`, `sound/index.ts`, `sound/README.md`, `docs/modules.md`.

**Interfaces:**

- Produces in `project`:
  - `interface TrackMix { volumeDb: number; pan: number }` (later stages add optional fields), `Track.mix?: TrackMix`.
  - `interface MasterMix { volumeDb: number }`; `interface MixSnapshot { tracks: Record<TrackId, TrackMix>; master: MasterMix }`; `interface CompositionMix { master: MasterMix; activeMix: "a" | "b"; otherMix?: MixSnapshot }`, `Composition.mix?: CompositionMix`.
  - `DEFAULT_TRACK_MIX`, `DEFAULT_COMPOSITION_MIX` (`{ master: { volumeDb: 0 }, activeMix: "a" }`); `trackMixOf(track: Track): TrackMix`; `compositionMixOf(c: Composition): CompositionMix`; `minimizeTrackMix(mix): TrackMix | undefined` (undefined at the default).
  - `nestedSound(clipGain: number, clipPan: number, inner: TrackMix): { gain: number; pan: number }`: gain × `dbToLinear(inner.volumeDb)`, pan clamped to `-1..1` of `clipPan + inner.pan`. Preview and export both use it for inner tracks of a placed composition.
- Produces in `project` (moved, not rewritten): `volumeDbSchema`, `panSchema`, `eqBandSchema`, `eqSchema` in `logic/sound.schema.ts`; `minimize<T>(value: T, defaults: T): T | undefined` in `logic/sound.ts` (deep equality, undefined at the defaults), replacing `audio.commands.ts`'s `stored()`. `audio.commands.ts` imports them; its tests pass unchanged.
- Produces in `sound`: commands `setTrackMix` (`sound.setTrackMix`: `{ trackId, volumeDb?, pan? }`), `resetTrackMix` (`sound.resetTrackMix`: `{ trackId }`), `setMaster` (`sound.setMaster`: `{ compositionId?, volumeDb }`, default the actor's open composition), `switchMix` (`sound.switchMix`: `{ compositionId?, to: "a" | "b" }`). All undoable. Failures `sound.not_audio` (a video track), `sound.track_not_found`. Tools `sound_set_track_mix`, `sound_reset_track_mix`, `sound_set_master`, `sound_switch_mix`, each `commandTool`.

- [ ] **Step 1: Write the failing tests** in `sound.mix.commands.test.ts`, with `project.testing.ts`'s kernel helpers:

```ts
it("stores nothing at the defaults", async () => {
  await run(setTrackMix, { trackId: audio, volumeDb: -6 });
  await run(setTrackMix, { trackId: audio, volumeDb: 0 });
  expect(state().tracks[audio]!.mix).toBeUndefined();
});
it("refuses a video track", async () => {
  await expect(run(setTrackMix, { trackId: video, pan: 0.5 })).rejects.toMatchObject({
    code: "sound.not_audio",
  });
});
it("switches to B by copying A, and back to the same values", async () => {
  await run(setTrackMix, { trackId: audio, volumeDb: -6 });
  await run(switchMix, { to: "b" });
  expect(state().tracks[audio]!.mix?.volumeDb).toBe(-6);
  await run(setTrackMix, { trackId: audio, volumeDb: -12 });
  await run(switchMix, { to: "a" });
  expect(state().tracks[audio]!.mix?.volumeDb).toBe(-6);
  await run(switchMix, { to: "b" });
  expect(state().tracks[audio]!.mix?.volumeDb).toBe(-12);
});
it("undoes a switch in one step", async () => {
  /* switch, undo, activeMix is "a" again and values are A's */
});
```

- [ ] **Step 2:** Run `pnpm vitest run src/modules/sound/sound.mix.commands.test.ts`. Expected: FAIL, `setTrackMix` is not defined.

- [ ] **Step 3: Move first,** in its own commit: the schemas and `minimize` into `project`, `audio` importing them, `pnpm test` green with no test changed (`refactor(audio): sound schemas and minimize live in project`). **Then implement** the types, `logic/mix.ts`, the selectors and the commands, with `setTrackMix`'s input built from the moved schemas. `switchMix` swaps the live values (every audio track's `mix` and `master`) with `otherMix`; when `otherMix` is missing it copies the live ones. Tracks deleted since are dropped from the snapshot. Each command validates before `ctx.mutate`, and minimizes.

- [ ] **Step 4:** Run the test again. Expected: PASS. Then `pnpm typecheck && pnpm lint && pnpm test`.

- [ ] **Step 5:** Update `project/README.md` (the fields, "never stored at the default", why the version stays 3), `sound/README.md` (tier, requires `project`, the command and tool table in the template), `docs/modules.md` (sound row). Commit: `feat(sound): track and master mix in the document`.

### Task 2: The timeline's scope and sound-only edits

**Files:** Create `src/modules/timeline/logic/scope.ts`. Modify `shell.types.ts`, `core/README.md`, `app.keybindings.ts`, `preview.module.ts`, `timeline.types.ts`, `timeline.module.ts`, `timeline.menu.ts`, `timeline.move.commands.ts`, `timeline.split.commands.ts`, `timeline.commands.test.ts`, `ui/TimelinePanel.tsx`, `ui/TimelineClip.tsx`, `ui/TimelineToolbar.tsx`, `ui/clip.gesture.ts`, `timeline/index.ts`, `timeline/README.md`, `keyframe.module.ts`, `audio.module.ts`, `audio.menu.ts`, `collab.module.ts`.

**Interfaces:**

- Produces in core: `AppPage.keepsPlayback?: boolean`, `AppPage.timelineScope?: TimelineScopeName` where `type TimelineScopeName = "all" | "sound"` lives in `shell.types.ts` (core can't import timeline).
- Produces in `timeline`: `scopes?: TimelineScopeName[]` on `TimelineOverlay`, `TimelineTool`, `TimelineDock`, `TimelineMenuItems`, `ClipActions` and `ClipMenuEntry`; missing means `["all"]`. `inScope(entry, scope): boolean`; `activeScope(pages, active): TimelineScopeName` from `appPages`. `TimelinePanel({ scope?: TimelineScopeName })`, default `"all"`; `"sound"` lists audio tracks only.
- `moveClip`, `trimClip` and `deleteClips` take `soundOnly?: boolean`. With it, a linked clip on an audio track is unlinked first by a nested `ctx.execute(unlinkClips, …)`, so the edit and the unlink are one undo step, and the picture isn't touched. `splitAt` is unchanged: a cut changes no picture.
- The page's plain keys (Space, S, Delete) work where `keepsPlayback` is set. Delete and the clip gestures pass `soundOnly: activeScope(...) === "sound"`. The first sound-only unlink of a session calls `notify("info", "Sound unlinked from its picture")`.

- [ ] **Step 1: Write the failing tests** in `timeline.commands.test.ts`:

```ts
it("deletes only the sound of a linked clip with soundOnly, in one undo step", async () => {
  const { picture, sound } = await addLinkedVideo();
  await run(deleteClips, { clipIds: [sound], soundOnly: true });
  expect(state().clips[picture]).toBeDefined();
  expect(state().clips[picture]!.linkId).toBeUndefined();
  expect(state().clips[sound]).toBeUndefined();
  await undo();
  expect(state().clips[sound]!.linkId).toBe(state().clips[picture]!.linkId);
});
it("moves only the sound with soundOnly", async () => {
  const { picture, sound } = await addLinkedVideo();
  const before = state().clips[picture]!.start;
  await run(moveClip, { clipId: sound, start: 2_000_000, soundOnly: true });
  expect(state().clips[picture]!.start).toBe(before);
});
it("still moves both without soundOnly", async () => {
  /* today's behaviour, pinned */
});
```

- [ ] **Step 2:** Run `pnpm vitest run src/modules/timeline/timeline.commands.test.ts`. Expected: FAIL on `soundOnly`.

- [ ] **Step 3: Implement** `soundOnly` in the three commands and say it in each `description` (agents read it). Then the scope: `inScope` filters every point read in `TimelinePanel`, `TimelineClip` (badges, menu entries, entry by entry) and `TimelineToolbar`. On scope `"sound"` the header column uses its own width, never writing `headerWidth`.

- [ ] **Step 4: Opt in.** `scopes: ["all", "sound"]` on: `keyframe`'s mode tool, dock and badge; `audio`'s clip actions; `collab.playheads`; the timeline's Split menu entry. Nothing else.

- [ ] **Step 5: Page flags.** `app.keybindings.ts` allows plain keys on a page with `keepsPlayback`; `preview.module.ts` pauses only when the new page lacks it.

- [ ] **Step 6:** Run the tests, then `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS. Update `timeline/README.md` (scopes, `soundOnly`, which entries opt in) and `core/README.md` (the flags). Commit: `feat(timeline): a sound scope, and edits that leave the picture alone`.

### Task 3: One graph for all sound in the preview

**Files:** Create `engine/engine.soundnodes.ts`, `engine/engine.mixbus.ts`, `engine/engine.meters.ts`. Modify `engine.types.ts`, `engine.audiograph.ts`, `engine.audio.ts`, `engine.html.ts`, `preview.controller.ts`, `preview.types.ts`, `preview/index.ts`, `preview/README.md`, `audio/README.md`.

**Interfaces:**

- Consumes: `trackMixOf`, `compositionMixOf`, `nestedSound` (Task 1).
- Produces: `SoundChain.routeTo(bus: AudioNode): void`. `SoundGraph.mix(update: MixUpdate): void` where `MixUpdate = { tracks: { id: TrackId; mix: TrackMix; muted: boolean }[]; master: MasterMix; solo: TrackId[]; monitor: MonitorState }`. `MonitorState = { mono: boolean; dim: boolean; speakerDb: number }` (dim is −20 dB). `SoundGraph.levels(): MixLevels` with `MixLevels = { tracks: Record<TrackId, StereoLevel>; master: StereoLevel }`, `StereoLevel = { left: number; right: number }` in dBFS, `-Infinity` for silence.
- `PreviewApi.sound: PreviewSound` with `previewMix(target: TrackId | "master", patch: Partial<TrackMix> | null)` (a live value during a drag, cleared on release), `setMonitor(state: MonitorState)`, `setSolo(trackIds: TrackId[])`, `levels(): MixLevels`, `loudness(): LoudnessReading | null`, `resetLoudness()`. All ephemeral.

- [ ] **Step 0: Move first,** in its own commit: `setBand`, `BIQUAD_TYPE`, `CUT_Q_DB`, the upmix gain and the panner creation from `engine.audiograph.ts` into `engine.soundnodes.ts` as `createUpmix(context)`, `createEqFilters(context)`, `setBand(filter, band, on)`, `createPanner(context)`. `createChain` uses them; behaviour unchanged (`refactor(preview): sound nodes shared by chains and buses`).

- [ ] **Step 1:** In `engine.audio.ts`, `voiceSlot` attaches every audio-track element (`graph.attach`), drops `needsGraph`, and routes the chain to the bus of the track the clip sounds through: its own, or for a placed composition's inner clip, the top-level track of its `path`. Inner track volume and pan apply through `nestedSound`. An element that fails `attach` plays plain and the graph reports it once with `notify("error", …)` naming the file.

- [ ] **Step 2:** `engine.mixbus.ts` builds per track, from `engine.soundnodes.ts`, `upmix → panner → GainNode (fader) → analyser tap`, a master `GainNode → analyser tap → loudness worklet`, and a monitor stage (`ChannelMergerNode` sum for mono, dim gain, speaker gain) to `destination`. Buses are made for the open composition's audio tracks and dropped when a track goes. Solo sets other buses' fader to 0 through their gain, never the elements.

- [ ] **Step 3:** `engine.html.ts` calls `graph.mix(...)` when the project, the open composition, solo or the monitor change, not per frame. Live `previewMix` values win over the document's until cleared.

- [ ] **Step 4: Check by hand** with `pnpm tauri dev`: an untouched project sounds as before; a fader move changes level; solo works; a track muted in the document stays silent; a placed composition's inner track volume is heard. Then `pnpm typecheck && pnpm lint && pnpm test`.

- [ ] **Step 5:** Update `preview/README.md` (the graph, the API) and `audio/README.md` (the old "never enters Web Audio" invariant is gone). Commit: `feat(preview): every sound through track buses and a master`.

### Task 4: Live loudness and meters

**Files:** Create `preview/logic/loudness.ts`, `preview/logic/loudness.test.ts`, `preview/engine/loudness.worklet.ts`. Modify `engine.meters.ts`, `engine.mixbus.ts`.

**Interfaces:**

- Produces: `LoudnessReading = { momentary: number; shortTerm: number; integrated: number; range: number; truePeak: number }` (LUFS, LU, dBTP); `createLoudnessMeter(sampleRate: number): LoudnessMeter` with `push(left: Float32Array, right: Float32Array): void`, `read(): LoudnessReading`, `reset(): void`. Pure; the worklet wraps it and posts a reading every 100 ms.
- K-weighting coefficients are derived for any sample rate (ITU-R BS.1770-4 pre-filter and RLB), gating at −70 LUFS absolute and −10 LU relative, 400 ms blocks with 75 % overlap; range per EBU Tech 3342; true peak by 4× oversampling.

- [ ] **Step 1: Write the failing tests** in `loudness.test.ts`, from EBU Tech 3341:

```ts
const sine = (dbfs: number, seconds: number, rate = 48_000) => /* stereo 1 kHz at dbfs */;
it("reads a −23 dBFS stereo sine as −23 LUFS", () => {
  const meter = createLoudnessMeter(48_000);
  meter.push(...sine(-23, 20));
  expect(meter.read().integrated).toBeCloseTo(-23, 1);
});
it("reads a −33 dBFS stereo sine as −33 LUFS", () => { /* same, −33 */ });
it("gates silence out of the integrated value", () => { /* 10 s at −23, 10 s of silence: still −23 */ });
it("gives the same reading at 44.1 kHz", () => { /* −23 at 44_100 */ });
```

- [ ] **Step 2:** Run `pnpm vitest run src/modules/preview/logic/loudness.test.ts`. Expected: FAIL, not defined.

- [ ] **Step 3: Implement** `loudness.ts`, then the worklet. Load it the way Vite bundles a worklet module as a URL (`?worker&url`), as `engine.audiograph.ts` loads the pitch processor. Meters read `getFloatTimeDomainData` from a `ChannelSplitterNode` per bus and hold the peak for 1.5 s.

- [ ] **Step 4:** Run the tests. Expected: PASS. Commit: `feat(preview): live loudness and meters`.

### Task 5: Export the same tree

**Files:** Create `src-tauri/src/export/soundfilters.rs`, `src-tauri/src/export/mixgraph.rs`. Modify `recipe.rs`, `export/mod.rs`, `export.types.ts`, `export.commands.ts`, `logic/mixdown.ts`, `logic/mixdown.test.ts`, `export/README.md`.

**Interfaces:**

- Consumes: `trackMixOf`, `compositionMixOf`, `nestedSound` (Task 1).
- Produces: `SoundSegment.track: number`, an index into `ExportSpec.mix.tracks`. `ExportSpec.mix: SoundMix` with `SoundMix = { tracks: TrackMixSpec[]; master: { gain: number } }` and `TrackMixSpec = { gain: number; pan: number }` (linear gain). Rust mirrors both. `mixdown()` returns `{ segments: SoundSegment[]; mix: SoundMix }`; inner clips of a placement carry the outer track's index and the inner track's volume and pan folded in by `nestedSound`. Solo never reaches it.
- `mixgraph::sound_graph(chains: &[String], segments: &[SoundSegment], mix: &SoundMix, total: u64) -> String`: segments of a track → `amix` → `volume` and `soundfilters::pan_filter` when not default → all tracks `amix` → master `volume` when not 1 → `apad,atrim` → `[mixed]`. `recipe.rs` keeps building each segment's chain and hands them over.

- [ ] **Step 0: Move first,** in its own commit: the sound filter functions listed under Reuse, with their `sound_tests`, from `recipe.rs` to `soundfilters.rs`, `pub(super)` where `recipe.rs` needs them. `cargo test` passes with no test changed (`refactor(export): sound filters in their own file`).

- [ ] **Step 1: Write the failing tests.** In `mixgraph.rs`:

```rust
#[test]
fn a_default_mix_adds_no_volume_or_pan() {
    let graph = sound_graph(&[chain(0)], &[segment(0)], &SoundMix::default_for(1), 1_000_000);
    assert!(!graph.contains("volume="), "{graph}");
    assert!(!graph.contains("pan="), "{graph}");
}
#[test]
fn a_track_volume_applies_once_after_its_clips_mix() { /* two segments on track 0 at gain 0.5: one volume=0.500000 after their amix */ }
#[test]
fn master_volume_comes_last() { /* master 2.0: "volume=2.000000" after the tracks' amix, before apad */ }
```

In `mixdown.test.ts`: segments carry their track index; a placed composition's inner clip carries the outer track's index, with the inner track's −6 dB in its gain.

- [ ] **Step 2:** Run `cd src-tauri && cargo test mixgraph` and `pnpm vitest run src/modules/export/logic/mixdown.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Move today's `amix` tail from `recipe.rs` into `mixgraph.rs`. Existing `sound_tests` in `recipe.rs` stay and pass unchanged, which pins every segment's own chain.

- [ ] **Step 4:** Run both test suites and clippy. Expected: PASS. Update `export/README.md`. Commit: `feat(export): mix tracks and master as a tree`.

### Task 6: The Sound page and the mixer

**Files:** Create `sound.store.ts`, `sound.monitor.commands.ts`, `logic/meter.ts`, everything under `sound/ui/` listed in the File Tree, and `inspector/ui/ClipTabSections.tsx`. Modify `sound.module.ts`, `sound.ref.ts`, `sound.types.ts`, `sound/index.ts`, `sound.mcp.ts`, `ui/SoundPage.tsx`, `preview/ui/index.ts`, `preview/index.ts`, `inspector/index.ts`, `inspector/README.md`, `sound/README.md`.

**Interfaces:**

- Consumes: Task 1 commands, Task 2 `TimelinePanel({ scope: "sound" })`, Task 3 `PreviewApi.sound`, Task 4 `LoudnessReading`.
- Produces: `SOUND_PAGE = "sound.page"`; the page contributed with `keepsPlayback: true, timelineScope: "sound"`. `SoundViewState = { selectedTrack: TrackId | null; solo: TrackId[]; expanded: boolean; monitor: MonitorState }` per kernel. Commands `sound.setSolo` (`{ trackId, on }`) and `sound.setMonitor` (`Partial<MonitorState>`), not undoable, no MCP tools (they act on the user's ears, like `settings.open`). Tool `sound_get_levels`: the latest `MixLevels` and `LoudnessReading`, or a message that nothing is playing. `PreviewStage` exported from `preview`. `ClipTabSections({ tab: string })` exported from `inspector`: the selected clip's sections of one tab.
- `meterHeight(db: number): number` (0..1, −60 to 0 dBFS), `holdPeak(previous, now, at): …` in `logic/meter.ts`.

- [ ] **Step 1: The layout,** following the mockup and the spec's "The page": transport row; left column with `TimelinePanel scope="sound"` over a panel (`Clip` tab with `ClipTabSections tab="audio"`, `Loudness` tab) beside a small `PreviewStage`; right column `MixerPanel`. Mount the Sound page's `PreviewStage` only while the page is active, so the Edit canvas gets the frames back when it closes; check that the two never draw at once.

- [ ] **Step 2: The mixer.** One `MixerStrip` per audio track in `trackOrder`: name, id (`A1`…), "Sends to Master" as plain text, `PanSlider`, `Fader`, two `Meter`s, the dB value (`text-mark` when not 0), M (the existing `setTrackMuted`), S (`sound.setSolo`). `MasterStrip` pinned at the right, outside the scroller. "Expand all" toggles `expanded`. With no audio track, `EmptyState` and Master. Clicking a strip or a track header sets `selectedTrack` and scrolls the other into view.

- [ ] **Step 3: Gestures.** `fader.gesture.ts`: drag sets `previewMix` per pointer move and writes the handle with `style`; release sends one `sound.setTrackMix` (or `sound.setMaster`) and clears `previewMix`. Double-click returns to 0 dB. Pan the same. No React state while dragging (rule 24).

- [ ] **Step 4: Meters and loudness.** `meters.hook.ts` reads `levels()` in one `requestAnimationFrame` loop while the page is shown and writes heights through refs. `LoudnessTab` shows the reading, refreshed at 10 Hz the same way, with Reset; `LoudnessHistory` draws the short-term value over the last 60 s on a canvas in token colours.

- [ ] **Step 5: The transport.** Play, the time, Select, Cut (runs `timeline.splitAt` at the playhead), Snap; Mix A/B (`sound.switchMix`, the active one underlined in `--mark`); Mono, Dim and the speaker slider (`sound.setMonitor`).

- [ ] **Step 6:** `pnpm typecheck && pnpm lint && pnpm test`, then check by hand against the Review Focus. Update `sound/README.md` and `inspector/README.md`. Commit: `feat(sound): the Sound page with its mixer`.

### Task 7: Fade handles on the timeline

**Files:** Create `audio/ui/FadeHandles.tsx`, `audio/ui/fade.gesture.ts`. Modify `audio.module.ts`, `audio/README.md`.

**Interfaces:** Consumes `audio.setSound`. Produces a `clipActions` badge `audio.fades` with `scopes: ["all", "sound"]` on clips of audio tracks.

- [ ] **Step 1:** Draw a handle at each top corner and the fade's slope over the clip. Dragging writes the slope with `style` and sends one `audio.setSound` with `fadeIn` or `fadeOut` on release, clamped to the clip as the command already does. A clip whose fades are keyed or animated keeps working as the command allows.

- [ ] **Step 2:** `pnpm typecheck && pnpm lint && pnpm test`; check on both pages. Update `audio/README.md`. Commit: `feat(audio): fade handles on the timeline`.

### Task 8: Parity and platform check

**Files:** Create `docs/superpowers/specs/2026-11-03-sound-mix-check.md`.

- [ ] **Step 1:** On Linux: a project with three tracks, moved faders, a pan and a placed composition. Play it to the end and note the integrated loudness; export it and measure with `ffmpeg -i out.mp4 -af ebur128 -f null -`. Expected: within 0.5 LU.
- [ ] **Step 2:** On Windows (WebView2): the same project plays through the graph, meters move, the loudness worklet loads. If it doesn't, write what fails; that's the result, not a reason to stop.
- [ ] **Step 3:** Write both results in the check document and link it from `preview/README.md`. Commit: `docs(sound): what the mix check found`.
