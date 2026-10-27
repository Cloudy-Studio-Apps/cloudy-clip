# Linked Video and Audio Clips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Placing a video file creates a picture-only video clip and a linked audio clip that move, trim, split, select and delete together until unlinked.

**Architecture:** Links are a `linkId` on `Clip` (project document, undoable). Pure helpers in `timeline/logic/links.ts` expand a clip to its partners; every timeline command expands its targets through them and validates the whole group before one `ctx.mutate`. The native `ffprobe` step reports `hasAudio` with the proxy event. The preview engine picks `<video>`/`<audio>` by **track** kind and always mutes video elements.

**Tech Stack:** TypeScript (strict), Zod, Zustand, React 19, Vitest; Rust (Tauri 2, serde).

**Spec:** `docs/superpowers/specs/2026-10-27-linked-audio-design.md`

## Global Constraints

- Follow every rule in `CLAUDE.md` (layering, module anatomy, rules 13–25). Cross-module imports only via `@/modules/<name>` / `@/core` / `@/ui`.
- Every change to the project is a command: `defineCommand`, Zod input, `ctx.mutate`, `CommandFailure("timeline.<reason>", …)`, validate everything before writing, one undo step per command.
- Times are integer `Micros`. Ids from `createId()` (`createId("link")` for link ids).
- TSDoc on every exported symbol of `index.ts`, every command and MCP tool. Update the README of every module touched, in the README template (`docs/modules.md`).
- No React state on per-frame paths; gesture feedback via DOM, one command on release.
- Done = `pnpm typecheck`, `pnpm lint`, `pnpm test` pass; Rust: `cargo clippy --all-targets -- -D warnings` and `cargo test` pass.
- No commits unless the user asks; never add `Co-Authored-By` lines.

## Review Focus

- **Removing a track that holds one half of a pair** leaves the other clip with a `linkId` and no partner; it must behave as unlinked (moves, trims, splits alone). Test in Task 3.
- **A linked move where only the partner would overlap** must fail with `timeline.overlap` and change nothing. Test in Task 3.
- **A trim where the partner hits its neighbour first** must leave both clips with the same edge. Test in Task 3.
- **An agent splitting or deleting only the audio clip** must also split/delete the video clip. Test in Task 3.
- **Undo after adding a pair** removes both clips in one step. Test in Task 2.

---

### Task 1: Report whether a file has sound

**Files:**

- Modify: `src-tauri/src/media/proxy.rs` (`ProxyEvent`, `ProxyJobs::start`, tests module)
- Modify: `src/modules/media/media.types.ts` (`ProxyInfo`)
- Modify: `src/modules/media/media.store.ts` (`setProxy`)
- Create: `src/modules/media/media.audio.ts`
- Modify: `src/modules/media/index.ts`, `src/modules/media/README.md`
- Test: `src/modules/media/media.state.test.ts`, Rust tests in `proxy.rs`

**Interfaces:**

- Produces: `ProxyInfo.hasAudio?: boolean`; `mediaHasAudio(probe: MediaProbe | undefined): boolean` exported from `@/modules/media` (true unless `probe?.proxy?.hasAudio === false`).

- [ ] **Step 1: Write failing Rust test** `proxy_event_serializes_has_audio`: `serde_json::to_value(ProxyEvent { media_id: "m".into(), state: ProxyState::Skipped, progress: None, message: None, has_audio: Some(false) })` equals `json!({"mediaId":"m","state":"skipped","hasAudio":false})`; with `has_audio: None` the key is absent.
- [ ] **Step 2: Run** `cd src-tauri && cargo test proxy_event` → FAIL (no field `has_audio`).
- [ ] **Step 3: Implement.** Add `has_audio: Option<bool>` (`#[serde(skip_serializing_if = "Option::is_none")]`, doc comment) to `ProxyEvent`. In `start`, every event emitted after `ffprobe` succeeds carries `Some(probe.audio_codec.is_some())`; events before it (or without FFmpeg) carry `None`.
- [ ] **Step 4: Run** `cargo test` and `cargo clippy --all-targets -- -D warnings` → PASS.
- [ ] **Step 5: Write failing TS tests** in `media.state.test.ts`: (a) `setProxy("m", { state: "queued", hasAudio: false })` then `setProxy("m", { state: "ready" })` → `getProbe("m")?.proxy?.hasAudio === false`; (b) `mediaHasAudio(undefined) === true`, `mediaHasAudio({ status: "ready", proxy: { state: "skipped", hasAudio: false } }) === false`, `mediaHasAudio({ status: "ready" }) === true`.
- [ ] **Step 6: Run** `pnpm vitest run src/modules/media/media.state.test.ts` → FAIL.
- [ ] **Step 7: Implement** `hasAudio` on `ProxyInfo` (TSDoc: "Whether the file has a sound stream, from ffprobe; missing when unknown"), keep the previous `hasAudio` in `setProxy` like `message`, add `mediaHasAudio` in `media.audio.ts` and export it with TSDoc. README: note `hasAudio` under Proxies and `mediaHasAudio` under API.
- [ ] **Step 8: Run** the test file → PASS.

### Task 2: Link model and adding a pair

**Files:**

- Modify: `src/modules/project/project.types.ts` (`Clip.linkId`, `TrackKind` doc), `src/modules/project/README.md`
- Create: `src/modules/timeline/logic/links.ts`, `src/modules/timeline/logic/links.test.ts`
- Modify: `src/modules/timeline/timeline.clip.commands.ts` (`addClip`), `src/modules/timeline/logic/placement.ts`
- Test: `src/modules/timeline/timeline.commands.test.ts`

**Interfaces:**

- Consumes: `mediaHasAudio` (Task 1).
- Produces:
  - `Clip.linkId?: string` — "Clips sharing a linkId are linked: edited together until unlinked."
  - `partnersOf(state: ProjectState, clipId: ClipId): Clip[]` — other existing clips with the same `linkId` (empty when unlinked or the partner is gone).
  - `withPartners(state: ProjectState, clipIds: readonly ClipId[]): ClipId[]` — input plus partners, unique, input order first.
  - `freeTrack(state: ProjectState, kind: TrackKind, start: Micros, duration: Micros): TrackId | undefined` in `placement.ts` — first track of `kind` in `trackOrder` with no overlap.
  - `addClip` returns `{ clips: Clip[] }` (video first); new optional input `audioTrackId`.

- [ ] **Step 1: Write failing tests** in `links.test.ts`: `partnersOf` returns the partner; returns `[]` for an unlinked clip and for a `linkId` whose partner was deleted; `withPartners(["v"])` → `["v","a"]`, `withPartners(["a","v"])` → `["a","v"]` (no duplicates). Add a `freeTrack` test to `placement.test.ts`: skips a busy track, returns `undefined` when all are busy.
- [ ] **Step 2: Run** `pnpm vitest run src/modules/timeline/logic` → FAIL.
- [ ] **Step 3: Implement** `links.ts`, `freeTrack`, and `Clip.linkId`. `TrackKind` doc becomes: "Video tracks hold pictures; audio tracks hold sound (from audio files or the sound of video files)." Project README: mention `linkId`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Write failing command tests** (update existing tests to the `{ clips }` return):
  - `"adds a video as a linked picture and sound pair"`: `addClip({ mediaId: "mv" })` → 2 clips, one on a video and one on an audio track, same `start`/`sourceIn`/`duration`, same defined `linkId`.
  - `"adds only a picture for a video without sound"`: set `mv` probe `proxy: { state: "skipped", hasAudio: false }` → 1 clip, no `linkId`.
  - `"puts the sound on a new audio track when the first is busy"`: an audio clip `ma` at 0–60 s, then `addClip({ mediaId: "mv", start: 0 })` → sound on a second audio track.
  - `"a video dropped on an audio track puts its sound there"`: `addClip({ mediaId: "mv", trackId: <audio track> })` → audio clip on that track, picture on a video track.
  - `"undoes adding a pair in one step"`: one `kernel.history.undo()` → `doc()` equals the state before.
  - Audio file `ma` still yields one clip on an audio track.
- [ ] **Step 6: Run** `pnpm vitest run src/modules/timeline/timeline.commands.test.ts` → FAIL.
- [ ] **Step 7: Implement `addClip`.** Rules: `trackId` may be any kind; for video media it names the video track if it is video, else the audio track. `audioTrackId` (must be audio, else `timeline.kind_mismatch`) names the audio track. `start` defaults to the end of the chosen video track (as today). A named track must be free (`timeline.overlap`); an unnamed one is `freeTrack(...)` or a new track via `addTrack`. Sound is added only when `mediaHasAudio(probe)`. One `ctx.mutate` writes both clips with `linkId: createId("link")`. Update the command `description` and TSDoc to say it returns `{ clips }` and links picture and sound.
- [ ] **Step 8: Run** → PASS; `pnpm typecheck` passes after updating `TrackLane.tsx` / `TimelinePanel.tsx` callers (they ignore the return).

### Task 3: Linked edits and unlink

**Files:**

- Modify: `src/modules/timeline/timeline.clip.commands.ts` (`moveClip`, `trimClip`, `splitAt`, `deleteClips`, new `unlinkClips`)
- Modify: `src/modules/timeline/timeline.track.commands.ts` (`setTrackMuted`)
- Modify: `src/modules/timeline/timeline.commands.ts`, `timeline.mcp.ts`, `index.ts`, `README.md`
- Test: `src/modules/timeline/timeline.commands.test.ts`

**Interfaces:**

- Consumes: `partnersOf`, `withPartners` (Task 2).
- Produces: `unlinkClips` command `timeline.unlinkClips`, input `{ clipIds: string[] (min 1) }`, returns `{ unlinked: number }` (clips that lost their link); MCP tool `timeline_unlink_clips`.

- [ ] **Step 1: Write failing tests** (pair = `addClip({ mediaId: "mv" })`):
  - `"moves linked clips together"`: move the video to 3 s → audio `start` is 3 s.
  - `"refuses a linked move when the partner would overlap"`: an `ma` clip at 12–20 s on the pair's audio track; move the video to 5 s → `timeline.overlap`, `doc()` unchanged.
  - `"moves only the dragged clip to another track"`: move the video to a second video track → audio keeps its track.
  - `"trims linked clips to the same edge"`: an `ma` clip at 8 s on the audio track; trim the video's end to 9 s → both end at 8 s.
  - `"splits the partner too and links the halves"`: `splitAt({ at: 5 s, clipIds: [audioId] })` → 4 clips; left halves share the old `linkId`, right halves share a new, different `linkId`.
  - `"deletes the partner too"`: `deleteClips([audioId])` → no clips.
  - `"unlinks, then edits alone, and undo relinks"`: `unlinkClips([videoId])` → both have no `linkId`; moving the video leaves the audio; undo twice → linked again at the original place.
  - `"unlink fails when nothing is linked"`: `timeline.not_linked`.
  - `"a clip whose partner's track was removed edits alone"`: `removeTrack(audio track)`, then move the video → ok.
  - `"refuses muting a video track"`: `setTrackMuted({ trackId: video, muted: true })` → `timeline.kind_mismatch`.
- [ ] **Step 2: Run** the test file → FAIL.
- [ ] **Step 3: Implement.**
  - `moveClip`: `delta = start - clip.start`; partners keep their track and get `start + delta` (fail `timeline.out_of_range` if < 0); overlap check for every clip of the group ignoring the whole group; one `ctx.mutate`.
  - `trimClip`: clamp each group member with `clampTrim`; for `"start"` use the latest resulting start, for `"end"` the earliest resulting end; apply that edge time to all.
  - `splitAt`: when `clipIds` is given, expand with `withPartners`; right halves of each old `linkId` share one new `createId("link")`.
  - `deleteClips`: expand with `withPartners`.
  - `unlinkClips`: expand, drop `linkId`; fail `timeline.not_linked` if none had one.
  - `setTrackMuted`: video track → `timeline.kind_mismatch` ("Video tracks have no sound; mute the audio track.").
  - Update every touched command's `description`/TSDoc to say partners follow. Register `unlinkClips` in `timelineCommands`, `commandTool(unlinkClips, { name: "timeline_unlink_clips" })`, export it from `index.ts` with TSDoc. README: add the table row, rewrite **Rules** for links and picture-only video tracks.
- [ ] **Step 4: Run** `pnpm test` → PASS.

### Task 4: Selection includes partners

**Files:**

- Modify: `src/modules/timeline/timeline.store.ts`, `timeline.types.ts`, `timeline.module.ts`
- Test: `src/modules/timeline/timeline.view.test.ts`

**Interfaces:**

- Consumes: `partnersOf` (Task 2).
- Produces: `createTimelineView(partners?: (id: ClipId) => ClipId[])` (default `() => []`); `selectClip` doc: "Selecting a clip selects its linked partners; additive toggles the group."

- [ ] **Step 1: Write failing test** `"selectClip selects and toggles linked partners"`: view with `partners = id => ({ v: ["a"], a: ["v"] })[id] ?? []`; `selectClip("v")` → `["v","a"]`; `selectClip("x", true)` → `["v","a","x"]`; `selectClip("a", true)` → `["x"]`.
- [ ] **Step 2: Run** `pnpm vitest run src/modules/timeline/timeline.view.test.ts` → FAIL.
- [ ] **Step 3: Implement**; in `timeline.module.ts` pass `id => partnersOf(project.getState(), id).map(c => c.id)`. Update the README API line.
- [ ] **Step 4: Run** → PASS.

### Task 5: Preview plays sound only from audio tracks

**Files:**

- Modify: `src/modules/preview/engine/engine.html.ts` (`render`), `src/modules/preview/README.md`

**Interfaces:**

- Consumes: track kinds from the project; `MediaSlotPool.acquire(clip, kind, desired)` unchanged (kind now = track kind).

- [ ] **Step 1: Implement.** Collect upcoming clips with their track. Acquire slots with `track.kind`. Video slots: `muted = true` always. Audio slots: `muted = track.muted` (upcoming: `true`). `settled`/`draw` unchanged. README engine line: "elements are chosen by track kind; video elements are always muted, sound comes from audio-track clips (a video file's sound plays through an `<audio>` element on the same URL)."
- [ ] **Step 2: Run** `pnpm typecheck && pnpm test` → PASS.
- [ ] **Step 3: Verify in the app** (`pnpm tauri dev`, or a second instance with `CLOUDY_CLIP_MCP_PORT=7421` driven over MCP): add a video with sound, play → sound heard once; mute the audio track → silence, picture continues; `preview_capture_frame` still returns the picture.

### Task 6: Timeline UI for links

**Files:**

- Modify: `src/modules/timeline/ui/clip.gesture.ts`, `TimelineClip.tsx`, `TimelineToolbar.tsx`, `TrackHeader.tsx`, `TrackLane.tsx`, `src/modules/timeline/README.md`
- Modify: `docs/architecture.md` only where it says video tracks carry sound (grep "audio")

**Interfaces:**

- Consumes: `partnersOf`, `unlinkClips` (Tasks 2–3).

- [ ] **Step 1: Gesture feedback.** In `startClipGesture`, find partner elements with `root.querySelector('[data-clip-id="<id>"]')` (may be null when virtualized off-page). Move: partners get `translate(offsetX, 0)`; validity also checks every partner with `findOverlap` ignoring the group. Trim: compute the shared edge as in `trimClip` (tightest of each member's `clampTrim`) and apply `left`/`width` to all. `onEnd` restores every touched element.
- [ ] **Step 2: Clip header.** `TimelineClip` shows a `lucide-react` `Link` icon (`size-3`, `aria-label="Linked"`) before the name when `partnersOf(state, clip.id).length > 0` (select a boolean, stable).
- [ ] **Step 3: Toolbar.** `Unlink` button (`lucide-react` `Unlink`, title "Unlink picture and sound") after Delete, disabled unless a selected clip has a partner; runs `unlinkClips({ clipIds: selection })`.
- [ ] **Step 4: Track header.** Render the mute button only for audio tracks.
- [ ] **Step 5: Drop.** `TrackLane` passes `trackId: track.id` for every drop (the command now places the sound on an audio lane drop).
- [ ] **Step 6: Run** `pnpm typecheck && pnpm lint && pnpm test` → PASS.
- [ ] **Step 7: Verify in the app**: drop a video → two linked clips with link icons; drag either → both move live; trim either → both trim; S splits both; Delete removes both; Unlink → icons go, clips move alone; Ctrl+Z relinks; a video with no sound → one clip; video track has no mute button.
- [ ] **Step 8: Docs sweep.** Timeline README (Contributes/Rules/table), `docs/architecture.md` wording; final `pnpm typecheck && pnpm lint && pnpm test` and `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test` → all PASS.
