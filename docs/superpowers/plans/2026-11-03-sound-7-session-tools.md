# Sound, Stage 7: Session Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Markers on the Sound page, a loop region, audio scrub and voice recording onto a track.

**Architecture:** Markers come from the timeline markers project; this stage only shows them on the Sound page. The loop region and scrub are playback behaviour in `preview`, ephemeral. Recording starts with a check that a microphone opens at all in WebKitGTK and WebView2; it captures with `MediaRecorder` or an `AudioWorklet`, writes a WAV next to the project through a Tauri command, imports it and places it as a clip.

**Tech Stack:** TypeScript, React 19, Zod, Web Audio, `getUserMedia`, Vitest, Rust (Tauri 2).

**Spec:** `docs/superpowers/specs/2026-11-02-sound-page-design.md`, "Session tools (stage 7)". Requires Stage 1, and Task 1 requires the timeline markers project to be built first (it isn't yet, as of 3 Nov 2026). **Owner's instruction:** stop before Task 1 and wait until the markers project is built and merged; don't build markers here and don't run its plan without being asked.

## Reuse

- Markers, their commands, tools, flags and snapping are the timeline markers project's; this stage opts them into the sound scope. If markers add a snap-target mechanism first, Stage 6's beats use it instead of adding `timelineSnapTargets`.
- Scrub plays through the Stage 1 graph, so slices are mixed and metered like playback.
- A recording is imported with `media`'s import command and placed with `timeline.addClip`, nested in `sound.placeRecording`.
- Writing the WAV reuses the media cache's folder handling where the project has no folder yet.

## Global Constraints

- `CLAUDE.md` rules apply; TypeScript and Rust checks pass; commits carry no `Co-Authored-By` line.
- Loop and scrub are view state.
- Recording ships only on platforms where Task 3's check passes. Elsewhere the record button is absent.
- The microphone permission is the user's: an agent can't start a recording.

## Review Focus

1. **Recording stopped by leaving the page or closing the project:** what was recorded is saved and placed, or the user is told why not. Checked in Task 4.
2. **Loop shorter than a frame or past the composition's end:** refused or clamped. Tested in Task 2.
3. **A marker added with M on the Sound page:** shows on Edit at the same time. Checked in Task 1.
4. **Scrub over a clip with pitch or speed:** plays what the clip sounds like there. Checked in Task 2.
5. **A record-armed track that's a group or muted:** not offered. Checked in Task 4.

## File Tree

```
docs/superpowers/specs/
  + 2026-11-03-microphone-check.md
src/modules/
  <the markers module>
    ~ <name>.module.ts                          its flags, snapping and keys in both scopes
  sound/
    + sound.record.ts                           capture, levels, stop
    + sound.record.commands.ts                  sound.placeRecording
    + ui/RecordButton.tsx, ui/ArmButton.tsx
    ~ ui/SoundTransport.tsx, ui/MixerStrip.tsx, sound.store.ts, sound.module.ts, sound.mcp.ts, README.md
  preview/
    ~ preview.clock.ts                          loop region
    + preview.scrub.ts                          short slices while dragging
    ~ preview.types.ts, README.md
  timeline/
    ~ ui/Ruler.tsx                              loop handles, scrub drag
src-tauri/
  ~ capabilities/default.json                   microphone, if needed
  src/sound/
    + record.rs                                 write the WAV next to the project
    ~ commands.rs
```

---

### Task 1: Markers on the Sound page

Markers are built by the timeline markers project (`docs/superpowers/specs/2026-11-03-timeline-markers-design.md`): data, commands, tools, flags in the ruler, snapping, M and Shift+M. This stage writes none of that again.

**Files:** Modify whichever module that project puts the flags and keys in (its `<name>.module.ts`), and `sound/README.md`.

- [ ] **Step 1:** Opt the markers' ruler flags, snapping and keys into `scopes: ["all", "sound"]` (Stage 1's timeline scope), so they show and work on the Sound page.
- [ ] **Step 2:** Full checks; check a marker added on Sound shows on Edit. Commit: `feat(sound): markers on the Sound page`.

### Task 2: Loop and scrub

**Files:** Create `preview.scrub.ts`. Modify `preview.clock.ts`, `preview.types.ts`, `timeline/ui/Ruler.tsx`, `SoundTransport.tsx`.

**Interfaces:** `PlaybackClock.setLoop(range: { from: Micros; to: Micros } | null)`; ranges shorter than one frame are refused, ends past the composition clamped. `PreviewApi.scrub(time: Micros)` plays 80 ms from there through the graph.

- [ ] **Step 1: Write the failing test** for the clock: at `to` it seeks to `from` while playing; a too-short range is refused.
- [ ] **Step 2:** Implement until PASS. Ruler handles for the loop and a scrub drag, both scopes. Commit: `feat(preview): loop and scrub`.

### Task 3: Microphone check

**Files:** Create `docs/superpowers/specs/2026-11-03-microphone-check.md`.

- [ ] **Step 1:** In a scratch window as in the Web Audio check: `navigator.mediaDevices.getUserMedia({ audio: true })` on WebKitGTK and WebView2; whether a permission prompt shows, whether samples arrive through an `AudioWorklet`, and the latency from a click to its sound.
- [ ] **Step 2:** Write what passed and failed per platform. If neither passes, stop and tell the owner. Commit: `docs(sound): what the microphone check found`.

### Task 4: Recording

**Files:** Create `sound.record.ts`, `sound.record.commands.ts`, `ui/RecordButton.tsx`, `ui/ArmButton.tsx`, `src-tauri/src/sound/record.rs`. Modify `sound/commands.rs`, `MixerStrip.tsx`, `SoundTransport.tsx`, `sound.store.ts`, `capabilities/default.json` if the check needed it.

**Interfaces:** Tauri `sound_record_write({ projectDir, name, chunk, done })` appends PCM to a WAV beside the project. `sound.placeRecording { trackId; path; at }` (undoable) imports and places it. `SoundViewState.armed: TrackId | null`. No MCP tool for recording.

- [ ] **Step 1:** Arm a track (audio, not muted), press record: playback starts, the input meter shows, the clip grows on the lane. Stop places it in one undo step. Leaving the page or closing the project stops and places, or says why it couldn't.
- [ ] **Step 2:** Full checks; record on each platform the check passed. Commit: `feat(sound): record a voice onto a track`.
