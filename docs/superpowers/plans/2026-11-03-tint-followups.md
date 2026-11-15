# Tint page: follow-ups for the owner

The Tint page branch is finished and its tests pass (585 TypeScript, 64 Rust). This is what is
left for you: checks only you can run, choices you may want to change, open gaps, and what v1
leaves out on purpose. The design is in
[the Tint page design](../specs/2026-11-03-tint-page-design.md).

## 1. Checks only the owner can do

1. **Windows check.** Follow the steps in
   [the WebGL check](../specs/2026-11-03-tint-webgl-check.md). Only Linux was measured.
2. **A hidden-window Linux run.** Everything so far ran with the window visible or in a headless
   browser. Run the grade, export and scopes once with the app window hidden or minimized.
3. **Try the page in the desktop app with real footage.** Most gestures were checked in a headless
   browser, not by hand. These were never exercised at all:
   - card opacity scrub on a sealed card
   - "Shared key" and "Tidy up" in the node menu
   - the wire hit path against the pan surface in the node graph
   - right after a release, one frame can flicker (the drag transform is cleared before the
     page redraws)
   - the zoom chip after entering the clean viewer
   - copy/paste of a whole shot group, and stills and looks on a long timeline
4. **Untouched export against a master build.** It was only compared with the source decode
   (ProRes, Y 49.7 dB, U 41.4 dB, V 38.6 dB), because a master build did not fit in memory. Export
   one clip with no grade from this branch and from master, and compare the two files.

## 2. Decisions you may want to revisit

1. **Color mix is folded into the hue curves.** One curve table, one pass. The mix reads the color
   at the curves step, not before. Alternative: a separate mix pass, a little slower to build.
2. **Color mix, warper and mixer cannot be keyframed.** They would rebuild their tables every
   frame. Every other value and opacity can be. Alternative: a different table design.
3. **sRGB input means "match display light".** It uses the inverse of the BT.1886 curve, not the
   BT.709 curve. Pick the other one if you prefer the camera look.
4. **Highs are kept past white inside the grade.** Only values below 0 are clamped on input; the
   final output clamps. Good for log footage; a strong grade can pull converted highs back and
   differ by up to 4 steps (16 of 384,000 pixels measured). Alternative: 32-bit float targets.
5. **The chart refusal threshold is 0.1.** A picked chart or color with less than that is refused
   as unusable. Raising it refuses more shots; lowering it lets bad reads through.
6. **Looks and stills are a chain of named layers at the bottom, not a group.** Stacked branches
   all read the same input, so Normal blends would show only the last. Cost of a group: it has no
   name field.
7. **Auto, white and gray with nothing selected write the first correction of the stack.** That
   is what the tools edit with nothing selected, and what the UI does. Alternative: the bottom one.
8. **Readouts are off under false color and the clip warning.** They show a short note, not RGB.
   Reading an unpassed copy needs a change in preview.
9. **The GPU table cap counts entries (256), not bytes.** Many different 65-cube LUTs could still
   use a lot of memory, and one run over more than 256 keys re-uploads every frame.
10. **Live levels correction stays on despite the playback cost on Linux** (4K about 40 against
    53 fps, three 1080p 23 to 38 against 46). A preview that lies was worse. Alternative: limit it
    to the Tint page or to when paused; a small switch in the engine.
11. **Versions are per clip only.** There are no versions at the group or timeline level.
12. **Match works at clip level only.** Not on a group or on the timeline grade.
13. **Bypass and compare reset when you leave the Tint page.** Edit never shows an ungraded clip
    quietly. Alternative: keep them on, as the Sound page's solo does not.
14. **Pasting a grade never changes the target's camera input.** The color space belongs to the
    footage. Alternative: paste it with the grade.
15. **Warper grid is 12 hues by 3 rings (36 points).** A center point later means a constant and a
    file-format change.

## 3. Known gaps, still open

Checked against HEAD. The ones a user would notice first are marked **first**.

### Grading math

- A keep-brightness scale jumps from 1 to 20 as gray crosses 0.05; the floor bounds the scale,
  not the output (`src/modules/tint/logic/color/mixer.ts:15`).
- Warper offsets next to each other near plus or minus 180 degrees blend through 0.
- Color mix "Pick" reads the color entering the correction, but the mix acts at the curves step.
- A pick on a transparent clip is darkened by the clip's opacity over the background
  (`tint.pick.ts`).
- A clip with no probed size skips the off-picture test for picks.
- Full-range video can be expanded twice on a webview that already corrects video levels, and
  unprobed full-range video is drawn as video range until the probe lands (pre-existing).

### GPU and performance

- **first** The first capture after launch waits for the levels measure, up to 10 seconds
  (`src/modules/preview/preview.levels.ts:9`), beyond the documented 3.
- **first** A failed startup measure leaves live and capture uncorrected for the whole session.
- A broken filter is retried and its failure reported every frame; a failing run names every
  filter in it, healthy ones too (`engine.filters.ts:157`).
- A throwing `applies` or `ready` is not caught, only `passes` is (`engine.filters.ts:74`), so the
  live preview would stop instead of skipping the filter.
- One failed recreate after a lost context disables the runner for the rest of the session
  (`gpu.runner.ts:157`).
- The "colors may look flat" notice fires once per engine, not once per session.
- A correction at its defaults still costs a GPU pass and may move a value by one 8-bit step.
- `scopeStats` works at full capture resolution; it could read about 256 columns
  (`logic/scopes.ts`).
- A capture with `only` still waits for clips it does not paint, such as a junction neighbour.
- Thumbnails of a clip redraw every node after any edit, and a capture already in flight finishes
  after playback starts.

### Document and files

- Minimizing a grade compares defaults with `JSON.stringify`, so key order matters
  (`project/logic/grade.ts:209`); same in `tint/logic/paste.ts:37`.
- A dropped broken clip grade can leave a grade version or `grade.*` key tracks pointing at
  nothing; readers must tolerate it.
- Freeze frame can bake a grade whose key track points at a node that is gone.
- Out-of-order undo of a step that created or removed a whole `gradeGroups`, `luts` or `stills`
  collection is refused if someone changed it since.
- Joining two clips shifts only the showing animation, not the parked versions'.
- Shot group names can repeat after a deletion ("Shot group 2" twice).
- Importing a LUT is two undo steps (the import is its own action).
- A grade saved by an early build of this branch with a picture ref to a key join fails on the
  next write (dev builds only).

### UI

- **first** The zoom chip finds the canvas once, at mount: it stays blank if the canvas appears
  later or is replaced, as when entering the clean viewer (`ui/ZoomChip.tsx:15`).
- **first** Readouts under false color or the clip warning show a note instead of values.
- **first** Delete removes a layer only when the row itself has focus (`ui/LayerRow.tsx:34`).
- The first drag on an ungraded clip shows nothing live until you release.
- Thumbnail failures are not logged or reported (`ui/thumbs.hook.ts`).
- Auto layout places only nodes without a position, so a mix of placed and unplaced nodes can
  overlap (`logic/autolayout.ts:23`).
- With a group selected, tools edit the first correction inside it (`ui/edit.target.hook.ts`).
- Looks and stills thumbnails at clip level include the group and timeline grades.
- The strip is not virtualized and asks the native side for file facts once per clip card.

### Agents and MCP

- `tint_scopes` reports an unknown composition as `preview.capture_failed`.
- Pick white and gray capture twice.
- A bare `catch` around `insertLayer` turns any bug into `tint.sealed`.
- `movePoint` can produce a non-increasing point list when an agent writes dense points; the
  commit is refused with a notice.
- The key-join `from` is refused on a limit write until a later stage allows it.

### Tests

- No test for freeze frame baking keyed grade values, version choice, the stills and LUT diffs,
  or the drift fix when joining clips.
- Command tests do not cover targets that are groups or compositions.

## 4. Not in v1, by design

- **8-bit only** (the README TODO): 10-bit and 16-bit sources, at least on export, so heavy grades
  on camera log footage do not band.
- No shapes or tracking (masks, power windows).
- No Detail tab (sharpen, noise reduction).
- No float composite: the composite is 8-bit, so end-to-end differences of 2 levels are accepted.
