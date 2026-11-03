# Sound, Stage 5: Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Deliver tab measures the whole mix against a standard such as YouTube, lists problems, matches the target in one step, and the Loudness tab gains a spectrum and stereo phase.

**Architecture:** A native analysis renders the mix through FFmpeg's `ebur128` and `astats` without playing it, as a background job, and returns figures and problem stretches. Match target changes Master's volume (and adds a limiter) so preview and export agree. The standard and target live in `CompositionMix.delivery`; codec and rate stay in the Export form.

**Tech Stack:** TypeScript, React 19, Zod, Web Audio `AnalyserNode`, Vitest, Rust (Tauri 2), FFmpeg.

**Spec:** `docs/superpowers/specs/2026-11-02-sound-page-design.md`, "Delivery (stage 5)". Requires Stages 1, 2 and 4.

## Reuse

- Analysis runs the same `mixgraph.rs` graph the export runs, with `-f null`, so it measures exactly what export writes.
- The analysis job uses the export runner's progress and cancel paths.
- The live correlation reading extends the Stage 1 loudness worklet; the spectrum reuses the Stage 1 master analyser.
- Match target writes through `sound.setMaster` and `sound.addEffect` nested.

## Global Constraints

- `CLAUDE.md` rules apply; TypeScript and Rust checks pass; commits carry no `Co-Authored-By` line.
- Standards are data. Before writing a figure down, check it against the platform's current published docs and cite the page in a comment: YouTube, Spotify, Apple Podcasts, TikTok, EBU R128, ATSC A/85, plus Custom.
- FFmpeg's `loudnorm` is never used.
- Match target: one undoable command that moves Master's volume and adds a Limiter at the peak limit if none is there, then analyzes once more and corrects once.
- Agents: `sound_analyze_mix`, `sound_match_target`, `sound_set_delivery`.

## Review Focus

1. **Match target on a quiet mix with no limiter:** the result is within 0.5 LU of the target and never over the peak limit. Checked in Task 3.
2. **Analysis while the user edits:** the result says which state it measured, and a stale result is marked stale. Tested in Task 2.
3. **A problem clicked:** seeks the user's playhead there, never an agent's. Checked in Task 4.
4. **A silent mix:** analysis reports "nothing to measure", not −inf as a number. Tested in Task 1.
5. **Match target on export** doesn't change the project. Tested in Task 3.

## File Tree

```
src/modules/
  project/
    ~ project.types.ts                          DeliverySettings, CompositionMix.delivery
  sound/
    + logic/standards.ts                        the standards, with sources
    + sound.delivery.commands.ts                setDelivery, analyzeMix, matchTarget
    + sound.delivery.commands.test.ts
    + sound.analysis.store.ts                   the last result per composition, stale flag
    + ui/deliver/ProblemList.tsx                the rows of ui/deliver/ProblemsCard.tsx
    + ui/lanes/ProblemMarks.tsx                 a timelineOverlay, both scopes
    + ui/loudness/SpectrumGraph.tsx, ui/loudness/PhaseMeter.tsx   the bodies of SpectrumCard and PhaseCard
    ~ ui/deliver/DeliverTab.tsx, ui/deliver/StandardCard.tsx, ui/deliver/ProblemsCard.tsx   laid out already; they work now
    ~ ui/panel/SoundPanel.tsx, ui/loudness/LoudnessTab.tsx, sound.mcp.ts, sound.module.ts, README.md
    ~ ui/soon/soon.catalog.ts                   loses this stage's entries
  preview/
    ~ engine/engine.meters.ts                   master spectrum
    ~ engine/loudness.worklet.ts, logic/loudness.ts   correlation
    ~ preview.types.ts, README.md
  export/
    ~ export.commands.ts, export.runner.ts      match target on export, analysis step
    ~ export.types.ts, ui/WhenSavingSection.tsx, README.md
src-tauri/src/
  + sound/analyze.rs                            ebur128 and astats over the mix graph
  ~ sound/commands.rs, sound/mod.rs             sound_analyze
  ~ export/mixgraph.rs                          pub for the analysis
```

---

### Task 1: Analysis

**Files:** Create `src-tauri/src/sound/analyze.rs`. Modify `sound/commands.rs`, `sound/mod.rs`, `export/mixgraph.rs`.

**Interfaces:** Tauri `sound_analyze(spec: SoundOnlySpec) -> Analysis` with `Analysis = { integrated: Option<f64>; range: f64; truePeak: f64; problems: Problem[] }`, `Problem = { at: u64; duration: u64; kind: "peak" | "clipped"; level: f64 }`, progress events, cancellable. It runs the same mix graph to `ebur128=peak=true:metadata=1,astats` and `-f null -`.

- [ ] **Step 1: Write the failing Rust tests:** parsing a captured `ebur128` summary gives the figures; a silent run gives `integrated: None`; frame metadata over the limit merges into problem stretches.
- [ ] **Step 2:** Implement until PASS. Commit: `feat(sound): analyze a whole mix`.

### Task 2: Delivery in the document, and its commands

**Files:** Create `logic/standards.ts`, `sound.delivery.commands.ts`, `sound.delivery.commands.test.ts`, `sound.analysis.store.ts`. Modify `project.types.ts`, `sound.mcp.ts`.

**Interfaces:** `DeliverySettings = { standard: StandardId; loudnessLufs: number; peakDbtp: number }`. `sound.setDelivery`, `sound.analyzeMix` (not undoable; stores the result with the project's history position), `sound.matchTarget` (undoable).

- [ ] **Step 1: Write the failing tests:** an edit after an analysis marks it stale; `matchTarget` with a result 4 LU under adds +4 dB to Master and a limiter at the peak limit, in one undo step.
- [ ] **Step 2:** Implement until PASS. Commit: `feat(sound): delivery standards`.

### Task 3: Match target, here and on export

**Files:** Modify `sound.delivery.commands.ts`, `export.commands.ts`, `export.runner.ts`, `export.types.ts`, `ui/WhenSavingSection.tsx`, README.

- [ ] **Step 1:** After `matchTarget` applies, analyze again and correct once by the remaining difference, capped so the limiter's ceiling isn't the only thing working.
- [ ] **Step 2:** `export.enqueue` takes `matchTarget?: boolean`: the job's runner analyzes first (a "measuring" status), adds the gain and limiter to its own spec only, and then renders. A test that the project is unchanged after such an enqueue.
- [ ] **Step 3:** Check by hand on a quiet project. Commit: `feat(sound): match the target`.

### Task 4: The Deliver tab, Problems, spectrum and phase

**Files:** Create `ui/deliver/ProblemList.tsx`, `ui/lanes/ProblemMarks.tsx`, `ui/loudness/SpectrumGraph.tsx`, `ui/loudness/PhaseMeter.tsx`. Modify `ui/deliver/DeliverTab.tsx` (laid out by the layout work), `ui/deliver/StandardCard.tsx`, `ui/deliver/ProblemsCard.tsx`, `ui/panel/SoundPanel.tsx`, `ui/loudness/LoudnessTab.tsx`, `ui/loudness/SpectrumCard.tsx`, `ui/loudness/PhaseCard.tsx`, `engine.meters.ts`, `loudness.worklet.ts`, `logic/loudness.ts`, `preview.types.ts`.

**Interfaces:** `LoudnessReading.correlation: number` (−1 to 1). `PreviewSound.spectrum(into: Float32Array): void`.

- [ ] **Step 1:** Deliver tab: standard picker, target and limit (custom editable), Analyze whole mix with progress, the result with "stale" when it is, Match target, the Export form's audio settings shown and edited from here.
- [ ] **Step 2:** Problems list; clicking seeks the user's clock. `ProblemMarks` draws red ticks on the ruler, both scopes.
- [ ] **Step 3:** Spectrum and phase in the Loudness tab, drawn per frame through refs.
- [ ] **Step 4: Replace this stage's placeholders with the working controls and remove its entries from `ui/soon/soon.catalog.ts`**, with their `soon(…)` calls: `deliver.standard` and `deliver.analyze` (`ui/deliver/StandardCard.tsx`), `loudness.spectrum` (`ui/loudness/SpectrumCard.tsx`) and `loudness.phase` (`ui/loudness/PhaseCard.tsx`). The Problems card's honest empty line becomes the list. Update the README's Placeholders and Not yet. Full checks. Commit: `feat(sound): the Deliver tab`.
