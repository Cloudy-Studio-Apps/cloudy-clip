# Sound, Stage 4: Groups, Audio Formats and Stems Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tracks send to group tracks such as Dialogue and Music & FX, the mixer filters by group, sound-only exports gain WAV, FLAC, AAC and Opus, and stems export as separate files that add up to the mix.

**Architecture:** `CompositionMix.buses: MixBus[]` and `TrackMix.busId`. The preview inserts a group bus between track buses and Master; the export tree gains a level. A stem job is a sound-only export whose FFmpeg run writes one file per group with `asplit` before Master, plus the full mix.

**Tech Stack:** TypeScript, React 19, Zod, Web Audio, Vitest, Rust (Tauri 2), FFmpeg.

**Spec:** `docs/superpowers/specs/2026-11-02-sound-page-design.md`, "Groups and stems (stage 4)". Requires Stages 1 and 2.

## Global Constraints

- `CLAUDE.md` rules apply; TypeScript and Rust checks pass; commits carry no `Co-Authored-By` line.
- Groups send to Master only. New tracks send to Master. A group has `id`, `name`, `volumeDb`, `muted`, `effects`.
- Stems: one per group, plus "Other" when any track sends to Master directly, plus the full mix. Taken after the group, before Master. Solo ignored.
- Formats: AAC, Opus, WAV, FLAC, MP3; 44.1 or 48 kHz; 16 or 24 bit for WAV and FLAC. They stay in the Export form (view state). `SAMPLE_RATE` becomes part of the spec.
- Ducking may listen to and sit on a group; loops are still refused.

## Reuse

- A group strip is `MixerStrip` with a flag, not a second component; a group bus is a Stage 1 track bus (built from `engine.soundnodes.ts`) whose input is other buses.
- Group effects are the Stage 2 chain, the same commands with `target` a `BusId`.
- `mixgraph.rs` builds a group level with the same function as the track level.
- Stems are jobs of the export queue: `job.rs` learns several outputs; nothing else runs FFmpeg.

## Review Focus

1. **Deleting a group:** its tracks send to Master, in one undo step. Tested in Task 1.
2. **Stems add up:** the sum of the stems equals the mix before Master within 0.1 dB. Checked in Task 4.
3. **A group muted:** its tracks are silent in preview and export, and its stem is silent. Tested in Task 2.
4. **A 44.1 kHz WAV export:** the file really is 44.1 kHz, 24 bit. Tested in Task 3.
5. **Mix A/B with groups:** switching swaps group values too and keeps group ids valid. Tested in Task 1.

## File Tree

```
src/modules/
  project/
    ~ project.types.ts                          MixBus, BusId, TrackMix.busId, CompositionMix.buses
    ~ logic/mix.ts, README.md
  sound/
    + sound.bus.commands.ts                     addBus, setBus, removeBus, sendTo
    + sound.bus.commands.test.ts
    + ui/BusStrip.tsx
    ~ ui/MixerPanel.tsx                         group strips, filters per group
    ~ ui/MixerStrip.tsx                         Sends to picker
    ~ sound.mix.commands.ts                     switchMix includes buses
    ~ sound.mcp.ts, README.md
  preview/
    ~ engine/engine.mixbus.ts                   group buses
  export/
    ~ export.types.ts                           ExportFormat grows; sampleRate, bitDepth; stems job
    ~ logic/presets.ts                          the new formats
    ~ logic/mixdown.ts, logic/mixdown.test.ts   bus index per track
    ~ export.commands.ts, export.runner.ts      stems
    ~ ui/SettingsSection.tsx, ui/WhatToExportSection.tsx
    ~ README.md
src-tauri/src/export/
  ~ recipe.rs                                   Format, sample rate, bit depth, encoders
  ~ mixgraph.rs                                 group level, stem outputs
  ~ job.rs, commands.rs                         several outputs in one job
```

---

### Task 1: Groups in the document

**Files:** Create `sound.bus.commands.ts`, `sound.bus.commands.test.ts`. Modify `project.types.ts`, `logic/mix.ts`, `sound.mix.commands.ts`, `sound.mcp.ts`, READMEs.

**Interfaces:** `MixBus = { id: BusId; name: string; volumeDb: number; muted: boolean; effects?: SoundEffect[] }`. Commands `sound.addBus { name }` → `{ busId }`, `sound.setBus { busId; patch }`, `sound.removeBus`, `sound.sendTo { trackIds; busId | null }`. Failures `sound.bus_not_found`. `MixSnapshot` gains `buses`. Tools for each.

- [ ] **Step 1: Write the failing tests:** removing a group sends its tracks to Master and one undo restores both; `switchMix` swaps group values; a duck listening to a group that's removed drops it.
- [ ] **Step 2:** Run. Expected: FAIL. Implement until PASS. Commit: `feat(sound): group tracks`.

### Task 2: Groups heard, exported and shown

**Files:** Create `ui/BusStrip.tsx`. Modify `engine.mixbus.ts`, `mixdown.ts`, `mixdown.test.ts`, `export.types.ts`, `mixgraph.rs`, `MixerPanel.tsx`, `MixerStrip.tsx`.

**Interfaces:** `TrackMixSpec.bus?: number` into `SoundMix.buses: BusMixSpec[]`.

- [ ] **Step 1: Write the failing tests:** Rust: tracks of group 0 `amix` into one chain with the group's volume before the master `amix`; a muted group adds no input. `mixdown`: a track's bus index.
- [ ] **Step 2:** Implement until PASS. Then the strips (after the tracks, scrolling with them), the Sends to picker and one filter button per group in the mixer header. Commit: `feat(sound): groups in the mix`.

### Task 3: Audio formats

**Files:** Modify `export.types.ts`, `logic/presets.ts`, `recipe.rs`, `ui/SettingsSection.tsx`, `export/README.md`.

**Interfaces:** `ExportFormat` adds `"wav" | "flac" | "aac" | "opus"`; `ExportSpec.sampleRate: 44100 | 48000`; `ExportSpec.bitDepth?: 16 | 24`. Rust `Format` mirrors; `pcm_s16le`/`pcm_s24le`, `flac -sample_fmt s16/s32 -bits_per_raw_sample 24`, `aac` in `.m4a`, `libopus` in `.opus`.

- [ ] **Step 1: Write the failing Rust tests:** WAV at 24 bit gives `pcm_s24le` and `-ar 44100` when asked; Opus forces 48 kHz.
- [ ] **Step 2:** Implement until PASS; check a real file's rate and depth with `ffprobe`. Commit: `feat(export): WAV, FLAC, AAC and Opus`.

### Task 4: Stems

**Files:** Modify `export.types.ts`, `export.commands.ts`, `export.runner.ts`, `ui/WhatToExportSection.tsx`, `mixgraph.rs`, `job.rs`, `commands.rs`, README.

**Interfaces:** `export.enqueue` takes `stems?: boolean`. A stem job writes `<name> - <group>.<ext>`, `<name> - Other.<ext>` when needed, and `<name> - Mix.<ext>`, with one FFmpeg run: each group's output is `asplit` into the master `amix` and a `-map` of its own.

- [ ] **Step 1: Write the failing Rust test:** two groups and a direct track give four outputs, each mapped once.
- [ ] **Step 2:** Implement until PASS. Check by hand that the stems summed in a DAW or with `amix` equal the mix before Master. Update README. Commit: `feat(export): stems`.
