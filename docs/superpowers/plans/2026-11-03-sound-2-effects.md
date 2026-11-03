# Sound, Stage 2: Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tracks and Master get effect chains (EQ, compressor, gate, de-esser, limiter, noise reduction, ducking) that sound the same in preview and export, edited in a Channel tab, with presets.

**Architecture:** `SoundEffect` is a closed tagged union in `project`. Each kind has a Zod schema, a Web Audio side (biquads, or one dynamics `AudioWorklet` that ports FFmpeg's formulas) and an FFmpeg side in `mixgraph.rs`. A parity check on the compressor comes first and decides the rest. Noise reduction renders files through FFmpeg, like reversed copies, and both sides play the rendered file.

**Tech Stack:** TypeScript, React 19, Zod, Web Audio `AudioWorklet`, Vitest, Rust (Tauri 2), FFmpeg (`acompressor`, `agate`, `deesser`, `alimiter`, `sidechaincompress`, `afftdn`).

**Spec:** `docs/superpowers/specs/2026-11-02-sound-page-design.md`, "Effects (stage 2)". Requires Stage 1.

## Global Constraints

- `CLAUDE.md` rules apply. Done means `pnpm typecheck`, `pnpm lint`, `pnpm test`, `cargo clippy --all-targets -- -D warnings` and `cargo test` pass. Commits carry no `Co-Authored-By` line.
- Effect kinds are a closed list: `eq`, `compressor`, `gate`, `deesser`, `limiter`, `denoise`, `duck`. One of each per chain, in the user's order. Rust builds filters from the structured spec, never from text the webview wrote.
- Parity bar: on a test signal, steady-state gain reduction within 0.5 dB of FFmpeg for every setting tried, attack and release times within 10 %. An effect that misses it is cut, and the owner is told.
- `DynamicsCompressorNode` is not used.
- Presets: Clear voice, Podcast, Phone, Radio, Warm built in; the user's own in `localStorage` key `cloudy-clip.sound-presets`, never in the project. Agents can list and apply presets, never save, rename or remove the user's own.
- Ducking sits on the lowered track, listens to a list of tracks summed into one key, and refuses loops with `sound.duck_loop`.
- Placed compositions: inner effects aren't heard from outside; the strip of the outer track says so in one line.
- Tests only where this plan names them.

## Reuse

- **EQ** is the clip's EQ: `{ on, bands: EqBand[6] }` with `DEFAULT_SOUND.eq` as its default, `eqSchema` (Stage 1), `createEqFilters`/`setBand` in the preview, `soundfilters::eq` in Rust, and in the UI one `EqEditor({ eq, disabled, onInput, onCommit })` made from `audio`'s `EqGraph` and `EqBandRow`. `audio`'s `EqSection` becomes a wrapper over `EqEditor`, so the inspector and the Channel tab draw the same editor.
- **Dynamics:** one core, not five. `logic/dynamics.ts` has one level detector and one gain computer with a knee; compressor, gate (downward expansion), limiter (with lookahead) and duck (compressor with an external key) are parameter sets over it, and the de-esser is the compressor on a band-passed key. One worklet runs any of them by `kind`.
- **Presets** store through `createSavedStore` (moved from `theme.store.ts` to `core/store`); theme switches to it in the same task.
- **Noise reduction** is a derived file. `reversed.rs`'s cache, progress and FFmpeg run are generalized into `media/derived.rs` with a `DerivedKind` (`Reversed`, `Denoised`); reversing moves onto it unchanged before denoise is added. TypeScript does the same with `media.reversed.ts` → `media.derived.ts`.
- **Effect sections** in the Channel tab use the inspector's `InspectorSection` and `FieldRow`, and `audio`'s `SoundRow`, so they fold, reset and look like the Audio tab.

## Review Focus

1. **A ducking choice that loops** (A listens to B, B to A): refused, nothing written. Tested in Task 2.
2. **Noise reduction while rendering:** the track plays the original and the strip shows progress; export waits for the file or refuses with a clear message. Checked in Task 6.
3. **A preset applied to a track that has effects:** the chain is replaced in one undo step. Tested in Task 2.
4. **Removing a track another track ducks under:** the listener's list drops it, nothing breaks. Tested in Task 2.
5. **Effects on Master and the limiter at the end of the chain:** export never clips above the limit. Tested in Task 4.

## File Tree

```
docs/superpowers/specs/
  + 2026-11-03-sound-dynamics-check.md          the parity result
src/modules/
  project/
    ~ project.types.ts                          SoundEffect union, TrackMix.effects, MasterMix.effects
    ~ logic/mix.ts                              effect defaults and minimize
    ~ README.md
  sound/
    + sound.effects.commands.ts                 add, set, remove, move, applyPreset
    + sound.effects.commands.test.ts
    + logic/effects.ts                          schemas per kind, duck graph check
    + logic/presets.ts                          the built-in presets
    + sound.presets.store.ts                    the user's presets, through createSavedStore
    ~ sound.module.ts, sound.mcp.ts, sound.types.ts, index.ts, README.md
    + ui/ChannelTab.tsx
    + ui/EffectChain.tsx                        strip list, + Effect, drag to reorder
    + ui/effects/EqEffect.tsx                   audio's EqEditor on the track's EQ
    + ui/effects/CompressorEffect.tsx, GateEffect.tsx, DeesserEffect.tsx, LimiterEffect.tsx
    + ui/effects/DenoiseEffect.tsx, DuckEffect.tsx
    + ui/effects/TransferGraph.tsx              in and out level curve
    + ui/PresetsSection.tsx                     Settings section
    ~ ui/SoundPanel.tsx, ui/MixerStrip.tsx, ui/MasterStrip.tsx
  audio/
    + ui/EqEditor.tsx                           EqGraph and EqBandRow, values in, callbacks out
    ~ ui/EqSection.tsx                          a wrapper over EqEditor
    ~ index.ts, ui/index.ts, README.md          export EqEditor, SoundRow
  theme/
    ~ theme.store.ts                            uses createSavedStore
src/core/store/
  + store.saved.ts                              createSavedStore(key, schema, defaults), moved from theme
src/core/
  ~ index.ts, README.md                         export createSavedStore
  preview/
    + engine/dynamics.worklet.ts                compressor, gate, de-esser, limiter, duck
    + logic/dynamics.ts, logic/dynamics.test.ts the ported formulas
    ~ engine/engine.mixbus.ts                   chains per bus, key signals
    ~ engine/engine.audio.ts                    plays the rendered file for denoise
    ~ README.md
  media/
    + media.derived.ts                          derived files: reversed (moved), denoised
    - media.reversed.ts                         folded into media.derived.ts
    ~ media.service.ts, media.types.ts, index.ts, README.md
  export/
    ~ export.types.ts, logic/mixdown.ts         effects in TrackMixSpec, rendered paths
    ~ logic/mixdown.test.ts, README.md
src-tauri/src/
  ~ lib.rs                                      registers sound commands
  + sound/mod.rs, sound/commands.rs             sound_denoise, sound_measure_floor
  + sound/denoise.rs                            the afftdn arguments only
  media/
    + derived.rs                                cache, progress, run: generalized from reversed.rs
    ~ reversed.rs                               its FFmpeg arguments only, on derived.rs
    ~ commands.rs, mod.rs
  export/
    ~ mixgraph.rs                               effect filters, sidechain branches
    ~ recipe.rs                                 SoundEffect types
```

---

### Task 1: Parity check on the compressor

**Files:** Create `preview/logic/dynamics.ts`, `preview/logic/dynamics.test.ts`, `docs/superpowers/specs/2026-11-03-sound-dynamics-check.md`.

**Interfaces:** Produces `compressorStep(state, input: number, params: CompressorParams, sampleRate): number` and `CompressorParams = { thresholdDb; ratio; attackMs; releaseMs; kneeDb; makeupDb }`, a port of FFmpeg's `acompressor` (peak detection, the same knee and coefficient formulas).

- [ ] **Step 1: Write the failing test:** a 1 kHz sine at −6 dBFS through `compressorStep` with threshold −18, ratio 4, for 2 s at 48 kHz: steady output level equals the value FFmpeg prints for `-af acompressor=threshold=-18dB:ratio=4,astats` within 0.5 dB. Record FFmpeg's figure in the test as a constant, with the command that produced it in a comment.
- [ ] **Step 2:** Run `pnpm vitest run src/modules/preview/logic/dynamics.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the port. Then compare attack and release: step from −30 to −6 dBFS and back, time to 90 % on both sides, within 10 %.
- [ ] **Step 4:** Run the tests. Expected: PASS. Write the results for three threshold and ratio pairs in the check document. If the bar isn't met, stop here and tell the owner. Commit: `docs(sound): the compressor matches FFmpeg`.

### Task 2: Effects in the document, and their commands

**Files:** Create `sound.effects.commands.ts`, `sound.effects.commands.test.ts`, `logic/effects.ts`, `logic/presets.ts`. Modify `project.types.ts`, `logic/mix.ts`, `sound.mcp.ts`, `sound.module.ts`, `project/README.md`, `sound/README.md`.

**Interfaces:**

- Produces in `project`: `type SoundEffect = { id: string; kind: "eq"; bands: EqBand[] } | { id; kind: "compressor"; params: CompressorParams } | { id; kind: "gate"; thresholdDb; ratio; attackMs; releaseMs } | { id; kind: "deesser"; frequencyHz; amount } | { id; kind: "limiter"; ceilingDb; releaseMs } | { id; kind: "denoise"; amountDb; floorDb } | { id; kind: "duck"; listensTo: TrackId[]; depthDb; attackMs; releaseMs }`, each with an `on: boolean`. `TrackMix.effects?`, `MasterMix.effects?`.
- Produces in `sound`: `sound.addEffect { target: TrackId | "master"; kind; at? }`, `sound.setEffect { target; effectId; patch }`, `sound.removeEffect`, `sound.moveEffect { target; effectId; to }`, `sound.applyPreset { target; presetId }`. Failures `sound.effect_exists`, `sound.effect_not_found`, `sound.duck_loop`, `sound.preset_not_found`. Tools `sound_add_effect`, `sound_set_effect`, `sound_remove_effect`, `sound_move_effect`, `sound_apply_preset`, `sound_list_presets`.
- Deleting a track drops it from every `listensTo` in the same step (a `settle` hook, as `project` does for fades).

- [ ] **Step 1: Write the failing tests:** a second compressor on a track fails `sound.effect_exists`; A ducks under B, then B under A fails `sound.duck_loop`; applying Clear voice to a track with a gate replaces the chain, and one undo brings the gate back; removing a listened track empties it from `listensTo`.
- [ ] **Step 2:** Run `pnpm vitest run src/modules/sound/sound.effects.commands.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Values out of range are refused by each kind's schema.
- [ ] **Step 4:** Run the tests, then the full checks. Expected: PASS. Commit: `feat(sound): effect chains on tracks and Master`.

### Task 3: Effects in the preview

**Files:** Create `engine/dynamics.worklet.ts`. Modify `engine.mixbus.ts`, `logic/dynamics.ts` (gate, de-esser, limiter, duck), `logic/dynamics.test.ts`, `preview/README.md`.

**Interfaces:** Consumes `SoundEffect`. A bus becomes `input → [chain in order] → pan → fader → meter`. `eq` is six `BiquadFilterNode`s as clip sound uses; the rest are one `AudioWorkletNode` per effect with parameters posted on change. `duck` takes a second input: the sum of the listened tracks after their faders. Buses are processed listeners-last.

- [ ] **Step 1: Write the failing tests** for the other ports against FFmpeg figures, as in Task 1: `agate`, `deesser` (on a 6.5 kHz tone), `alimiter` (a +6 dBFS sine never exceeds the ceiling after the lookahead).
- [ ] **Step 2:** Run them. Expected: FAIL. Implement until PASS. A port that can't meet the bar is cut and the owner told.
- [ ] **Step 3:** Wire the worklet. Check by hand that a strip's effects change what you hear, and that ducking lowers the music only while the voice speaks. Commit: `feat(preview): effects on buses`.

### Task 4: Effects in the export

**Files:** Modify `export.types.ts`, `logic/mixdown.ts`, `logic/mixdown.test.ts`, `src-tauri/src/export/mixgraph.rs`, `recipe.rs`, `export/README.md`.

**Interfaces:** `TrackMixSpec.effects` and `master.effects` carry the same union. `mixgraph.rs` turns each into its filter with the same parameters as the port; `duck` becomes `asplit` on the listened tracks' outputs, an `amix` of them as the key, and `sidechaincompress` on the lowered track.

- [ ] **Step 1: Write the failing Rust tests:** an empty chain adds nothing; `compressor` gives `acompressor` with its values; a duck on track 1 listening to track 0 splits track 0 after its fader and feeds `sidechaincompress`; a limiter on Master is the last filter before `apad`.
- [ ] **Step 2:** Run `cargo test mixgraph`. Expected: FAIL. Implement until PASS.
- [ ] **Step 3:** Export a project with every effect and compare by ear and with `ebur128` against a full play. Commit: `feat(export): effects in the mix`.

### Task 5: The Channel tab and presets

**Files:** Create `ui/ChannelTab.tsx`, `ui/EffectChain.tsx`, `ui/effects/*`, `ui/PresetsSection.tsx`, `sound.presets.store.ts`. Modify `ui/SoundPanel.tsx`, `ui/MixerStrip.tsx`, `ui/MasterStrip.tsx`, `audio/index.ts`, `audio/ui/index.ts`, `sound.module.ts` (requires `settings`), `sound/README.md`.

**Interfaces:** `audio` exports `EqEditor` and `SoundRow`. `PresetsSection` is contributed to `settingsSections` as "Sound presets". `core` exports `createSavedStore<T>(key: string, schema: z.ZodType<T>, defaults: T): StoreApi<T>`; `theme.store.ts` and `sound.presets.store.ts` both use it.

- [ ] **Step 0: Move first,** in its own commits: `createSavedStore` out of `theme.store.ts` into `core/store/store.saved.ts`, theme unchanged in behaviour; `EqEditor` out of `EqSection`, the inspector unchanged.

- [ ] **Step 1:** The strip lists its effects (an `--on` dot when on), `+ Effect` lists the kinds not yet there. Drag reorders through `sound.moveEffect`.
- [ ] **Step 2:** The Channel tab shows the selected track's or Master's chain as sections with a switch each, the EQ and transfer graphs in token colours, changed values in `--mark`. Drags preview live and send one command on release.
- [ ] **Step 3:** The preset picker and "Save as preset" (user's store only). Settings lists, renames and removes them.
- [ ] **Step 4:** Full checks; check by hand. Commit: `feat(sound): the Channel tab and presets`.

### Task 6: Noise reduction

**Files:** Create `src-tauri/src/sound/mod.rs`, `commands.rs`, `denoise.rs`, `src/modules/media/media.denoise.ts`. Modify `src-tauri/src/lib.rs`, `media.service.ts`, `media.types.ts`, `media/index.ts`, `media/README.md`, `engine.audio.ts`, `logic/mixdown.ts`.

**Interfaces:** `media/derived.rs`: `prepare(kind: DerivedKind, source, settings_key) -> PathBuf`, the cache key, progress events and the FFmpeg run that `reversed.rs` has today, generalized. Tauri `sound_denoise({ path, amountDb, floorDb }) -> { path }` is `prepare(Denoised { amount_db, floor_db }, …)` with `afftdn=nr=<amount>:nf=<floor>` to a WAV, keyed with a `DENOISE_RECIPE` number.

- [ ] **Step 0: Move first,** in its own commit: the cache, progress and run out of `reversed.rs` into `derived.rs`; reversing works and its tests pass unchanged. `sound_measure_floor({ path, from, to }) -> floorDb` from `astats`. `media.denoised(mediaId, settings)`: the cached path or a promise. Preview plays it when ready; export uses it, and `export.enqueue` fails `export.denoise_pending` while one is rendering.

- [ ] **Step 1: Write the failing Rust test:** the cache path changes with the settings and the recipe number, and not with anything else.
- [ ] **Step 2:** Run `cargo test sound::denoise`. Expected: FAIL. Implement until PASS.
- [ ] **Step 3:** Wire preview and export; check by hand on a noisy file, both during and after the render. Update READMEs. Commit: `feat(sound): noise reduction`.
