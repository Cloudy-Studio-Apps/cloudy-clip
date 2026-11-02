# Mesa de noche: Inspector Audio Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Volume, pan, fades, equalizer and pitch on a clip work in the inspector, and sound the same in preview and export.

**Architecture:** One `ClipSound` value on the clip holds everything. `project` owns its type and defaults, so core modules can read it. A new feature module `audio` owns the commands, tools and panel. Preview gets a Web Audio chain per sound element, and export adds matching FFmpeg filters per sound segment.

**Tech Stack:** Web Audio API, AudioWorklet, FFmpeg filters, Rust (`src-tauri/src/export`), React 19.

**Spec:** `docs/superpowers/specs/2026-11-02-mesa-de-noche-design.md`. Requires the Foundation and Edit plans.

**Visual reference:** `docs/prototype/designs/b-mesa-de-noche.html#page:edit,insp:audio` and `docs/prototype/designs/audio-tab.js`

## File Tree

`+` is a new file and `~` is an edited file.

```
cloudy-clip/
├─ ~ CLAUDE.md                              v1 scope, audio in "Where to look"
├─ ~ package.json                           soundtouch worklet
├─ ~ pnpm-lock.yaml
├─ docs/
│  ├─ ~ modules.md                          audio in the module table
│  └─ superpowers/specs/
│     └─ + 2026-11-02-audio-preview-check.md   what Task 1 found
├─ src-tauri/src/export/
│  └─ ~ recipe.rs                           gain, pan, EQ and pitch filters
└─ src/
   ├─ app/
   │  └─ ~ bootstrap.ts                     lists audio
   └─ modules/
      ├─ audio/
      │  ├─ + README.md
      │  ├─ + audio.commands.ts
      │  ├─ + audio.commands.test.ts
      │  ├─ + audio.mcp.ts
      │  ├─ + audio.module.ts
      │  ├─ + audio.ref.ts
      │  ├─ + audio.types.ts
      │  ├─ + index.ts
      │  ├─ logic/
      │  │  └─ + eq.ts                      eqResponse
      │  └─ ui/
      │     ├─ + AudioSections.tsx          volume, fades, pan, pitch
      │     ├─ + EqBandRow.tsx
      │     ├─ + EqGraph.tsx
      │     ├─ + EqSection.tsx
      │     ├─ + eq.gesture.ts
      │     ├─ + index.ts
      │     └─ + sections.ts
      ├─ export/
      │  ├─ ~ export.types.ts               SoundSegment fields
      │  └─ logic/
      │     ├─ ~ mixdown.ts
      │     └─ ~ mixdown.test.ts
      ├─ inspector/
      │  ├─ ~ README.md
      │  └─ ui/
      │     └─ ~ sections.ts                Sound moves below Volume and Fades
      ├─ preview/engine/
      │  ├─ ~ engine.audio.ts
      │  ├─ + engine.audiograph.ts          the Web Audio chain
      │  └─ ~ engine.html.ts
      ├─ project/
      │  ├─ ~ README.md
      │  ├─ ~ index.ts
      │  ├─ ~ project.types.ts              ClipSound
      │  └─ logic/
      │     └─ + sound.ts                   DEFAULT_SOUND, soundOf
      └─ timeline/
         ├─ ~ timeline.clip.commands.ts     clamps fades on trim
         └─ ~ timeline.split.commands.ts    keeps fades on the outer edges
```

## Global Constraints

- Follow `CLAUDE.md`: a gesture sends one command on release, so it's one undo step. Dragging an EQ point or slider updates live values without React state on per-frame paths.
- Rule 20: media elements keep `crossOrigin = "anonymous"`. Rule 22 is unaffected, as pictures are untouched.
- The video-track rule stays: picture elements stay silent through `volume = 0`, never `muted`. Only sound elements enter the audio graph.
- Linked picture and sound: controls act on the clip with sound (`soundMember`).
- Done means `pnpm typecheck`, `pnpm lint` and `pnpm test` pass, plus `cargo clippy --all-targets -- -D warnings` and `cargo test`.
- Commits have no Co-Authored-By line. Update `CLAUDE.md`'s v1 scope and the `audio` README in the commit that lands each control.

## Review Focus

- Default values must leave preview and export exactly as they are today, with no audible change and no filter in the FFmpeg command.
- Junction crossfades multiply with clip volume and fades: an overlap must not jump in level in preview or export.
- A split or trim keeps sound values sensible: fades stay at the outer edges of the pieces, and a fade longer than a trimmed clip is clamped.
- Clips inside a nested composition keep their own sound and apply the parent clip's sound on top.
- Seeking and looping with Web Audio must not click, duplicate sound, or leave elements connected after clips end. An element can only have one `MediaElementSource`, ever.

---

### Task 1: Prove Web Audio on WebKitGTK

**This task can stop the plan.**

**Files:**

- Create: `docs/superpowers/specs/2026-11-02-audio-preview-check.md`

- [ ] **Step 1: Try it in the real app**

On a scratch change that isn't committed, in `pnpm tauri dev` on Linux, connect one sound element through `MediaElementAudioSourceNode` → `StereoPannerNode` → `BiquadFilterNode` → destination, with a proxy-backed clip and a directly played one.
Expected: sound plays, and pan and filter are audible. A silent output means the loopback stream is treated as tainted.

- [ ] **Step 2: Try pitch**

Load `@soundtouchjs/audio-worklet` and shift by +3 semitones without changing speed.
Expected: pitch shifts in sync with the clock, with latency below 100 ms. Measure and record it.

- [ ] **Step 3: Record the result**

Write what worked for Linux and note Windows (WebView2) as untested if it can't be run. If Step 1 fails, stop and report it: everything after this needs a different approach. If only Step 2 fails, do Tasks 2–5 and skip Task 6.

### Task 2: The sound value

**Files:**

- Modify: `src/modules/project/project.types.ts`, `index.ts`, `README.md`
- Create: `src/modules/project/logic/sound.ts`
- Create: `src/modules/audio/` with `index.ts`, `audio.ref.ts`, `audio.module.ts`, `audio.types.ts`, `audio.commands.ts`, `audio.commands.test.ts`, `audio.mcp.ts`, `README.md`, `ui/index.ts`
- Modify: `src/app/bootstrap.ts`, `docs/modules.md`, `CLAUDE.md`
- Modify: `src/modules/timeline/timeline.split.commands.ts`, `timeline.clip.commands.ts` (fade edges)

**Interfaces:**

- Produces:

```ts
export interface EqBand {
  on: boolean;
  shape: "bell" | "lowShelf" | "highShelf" | "lowCut" | "highCut";
  hz: number;
  db: number;
  q: number;
}
export interface ClipSound {
  volumeDb: number; // -60..12
  pan: number; // -1..1
  fadeIn: Micros;
  fadeOut: Micros;
  pitch: { on: boolean; semitones: number; cents: number };
  eq: { on: boolean; bands: EqBand[] }; // always 6: B1..B6
}
// SharedGroupValues gains: sound: ClipSound
export const DEFAULT_SOUND: ClipSound;
export function soundOf(clip: Clip): ClipSound; // defaults when missing
```

Commands: `audio.setSound { clipIds, patch }`, `audio.resetSound { clipIds, section? }`. Tools: `audio_set_sound`, `audio_reset_sound`. Failures: `audio.no_sound` (a clip with no sound).

- [ ] **Step 1: Write the failing tests**

In `audio.commands.test.ts`: `setSound on linked clips changes the sound clip only`; `a split keeps fadeIn on the left piece and fadeOut on the right piece`; `a fade longer than the clip is clamped`; `undo restores in one step`.

- [ ] **Step 2: Run them**

Run: `pnpm vitest run src/modules/audio/audio.commands.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Declare the group so `project_get_state` shows it. Validate ranges with Zod. Don't store a value equal to the default. Change `CLAUDE.md`'s v1 scope to say clip sound controls are in scope. Bands default to the prototype's six in `audio-tab.js`.

- [ ] **Step 4: Run them, then commit**

Run: the command from Step 2.
Expected: PASS.

```bash
git add src docs CLAUDE.md
git commit -m "feat(audio): sound values on clips"
```

### Task 3: Volume and fades

**Files:**

- Create: `src/modules/preview/engine/engine.audiograph.ts`
- Modify: `src/modules/preview/engine/engine.html.ts`, `engine.audio.ts`, `src/modules/export/export.types.ts`, `src/modules/export/logic/mixdown.ts`, `mixdown.test.ts`, `src-tauri/src/export/recipe.rs`
- Create: `src/modules/audio/ui/AudioSections.tsx`, `src/modules/audio/ui/sections.ts`
- Modify: `src/modules/audio/audio.module.ts`, `src/modules/inspector/ui/sections.ts`

**Interfaces:**

- Produces in preview:

```ts
export interface SoundGraph {
  /** Connects a sound element once; it stays connected for the element's life. */
  attach(element: HTMLMediaElement): SoundChain;
  dispose(): void;
}
export interface SoundChain {
  apply(sound: ClipSound, gain: number): void;
}
```

- Produces in export: `SoundSegment` gains `gain: f64` (linear) in TypeScript and Rust, with `#[serde(default = "one")]`.

- [ ] **Step 1: Write the failing test**

In `mixdown.test.ts`: `a clip at -6 dB exports at half gain with its own fades`, with `gain` close to `0.501` and `fadeIn` equal to the clip's.

- [ ] **Step 2: Run it**

Run: `pnpm vitest run src/modules/export/logic/mixdown.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

The engine computes gain as `own × dbToLinear(volumeDb) × fade at the current time` and sets it through `SoundChain.apply` with `setTargetAtTime`, 10 ms. `mixdown.ts` keeps the larger of a junction fade and the clip's fade, as `walk` does for edges. `recipe.rs` adds `volume=` only when `gain != 1.0`. Add a Rust test that a default segment produces the same filter string as today.

- [ ] **Step 4: Add the sections**

Contribute Volume and Fades to `inspectorSections` on tab `audio`, using `SliderField`. Reset arrows yes, keyframe diamonds no. The existing Sound section's Track and Mute move below them.

- [ ] **Step 5: Verify**

Run: `pnpm vitest run src/modules/export/logic/mixdown.test.ts && cd src-tauri && cargo test`
Expected: PASS. In the app, volume and fades match between preview and an exported file.

- [ ] **Step 6: Commit**

```bash
git add src src-tauri
git commit -m "feat(audio): clip volume and fades in preview and export"
```

### Task 4: Pan

**Files:**

- Modify: `src/modules/preview/engine/engine.audiograph.ts`, `src/modules/export/logic/mixdown.ts`, `mixdown.test.ts`, `src-tauri/src/export/recipe.rs`, `src/modules/audio/ui/AudioSections.tsx`

**Interfaces:**

- Produces: `SoundSegment.pan: f64`, default 0.

- [ ] **Step 1: Implement and test**

Use `StereoPannerNode` in preview. Export uses `stereotools=balance_out=<pan>`, only when `pan != 0`. Check `mono` segments, which play on both sides. Add a Rust test for the filter string.

- [ ] **Step 2: Add the Pan row**

Show C, L and R as the prototype does.

- [ ] **Step 3: Verify and commit**

Run: `cd src-tauri && cargo test`, then `pnpm typecheck && pnpm lint && pnpm test`.
Expected: all pass. A hard-left clip plays left in preview and in an exported file.

```bash
git add src src-tauri
git commit -m "feat(audio): pan in preview and export"
```

### Task 5: Equalizer

**Files:**

- Create: `src/modules/audio/logic/eq.ts`, `src/modules/audio/ui/EqSection.tsx`, `EqGraph.tsx`, `EqBandRow.tsx`, `eq.gesture.ts`
- Modify: `src/modules/preview/engine/engine.audiograph.ts`, `src/modules/export/logic/mixdown.ts`, `src-tauri/src/export/recipe.rs`

**Interfaces:**

- Produces: `eqResponse(bands: readonly EqBand[], hz: number, sampleRate: number): number` returning dB, and `SoundSegment.eq: EqFilter[]`, each with `kind`, `hz`, `db`, `q`.

- [ ] **Step 1: Graph and gesture**

Port `audio-tab.js`: draggable numbered nodes, gain scale on the right only, bands B1–B6 with on/off and shape cycling. The drag writes to the DOM and to the live chain, then sends one `audio.setSound` on release.

- [ ] **Step 2: Sound**

Preview uses six `BiquadFilterNode`s, bypassed when off. Export uses `equalizer` for bell, `bass`/`treble` for shelves, and `highpass`/`lowpass` for cuts, and adds nothing for a band that's off. Add a Rust test for the filter chain.

- [ ] **Step 3: Verify and commit**

Run: `cd src-tauri && cargo test`, then `pnpm typecheck && pnpm lint && pnpm test`.
Expected: all pass. A strong cut sounds alike in preview and export.

```bash
git add src src-tauri
git commit -m "feat(audio): six-band equalizer in preview and export"
```

### Task 6: Pitch

Skip this task if Task 1 Step 2 failed, and leave the Pitch section out.

**Files:**

- Modify: `package.json`, `src/modules/preview/engine/engine.audiograph.ts`, `src/modules/export/logic/mixdown.ts`, `src-tauri/src/export/recipe.rs`, `src/modules/audio/ui/AudioSections.tsx`

**Interfaces:**

- Produces: `SoundSegment.pitch: f64` in semitones, `semitones + cents / 100`, default 0.

- [ ] **Step 1: Implement**

Preview inserts the worklet only while pitch is on. Export uses `asetrate=<rate × ratio>,aresample=<rate>,atempo=<1/ratio>`, because `rubberband` isn't in every system FFmpeg. Chain `atempo` steps if the ratio leaves its 0.5–2 range. Add a Rust test at +12 semitones.

- [ ] **Step 2: Add the rows**

Semitones and Cents, as in the prototype.

- [ ] **Step 3: Verify and commit**

Run: `cd src-tauri && cargo test`, then `pnpm typecheck && pnpm lint && pnpm test`.
Expected: all pass. The clip's length doesn't change in an exported file, and pitch matches preview.

```bash
git add src src-tauri package.json pnpm-lock.yaml
git commit -m "feat(audio): pitch in preview and export"
```

### Task 7: Finish the tab

**Files:**

- Modify: `src/modules/audio/README.md`, `src/modules/inspector/README.md`, `docs/modules.md`

- [ ] **Step 1: Walk it**

Check section switches bypass and dim, as the prototype does. Check a linked clip, an audio-only clip, a nested composition, multi-selection and an agent's `audio_set_sound`. Ctrl+Z undoes each.

- [ ] **Step 2: Write the speed note**

Add to the `audio` README under "Not yet": Speed change needs its own plan, and what Task 6 measured.

- [ ] **Step 3: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`, then `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test`.
Expected: all pass.

```bash
git add src docs
git commit -m "docs(audio): the Audio tab's README and what's next"
```
