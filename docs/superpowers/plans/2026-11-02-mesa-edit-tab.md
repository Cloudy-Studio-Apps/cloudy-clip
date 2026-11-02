# Mesa de noche: Edit Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Edit page match the prototype: library panels, field-guide preview, exposure-sheet timeline, and the inspector with a real File tab.

**Architecture:** Mostly styling inside each module's `ui/`. Nothing on per-frame paths starts using React state, and engine and gesture logic stay untouched. The File tab reuses the sections the Media plan exports.

**Tech Stack:** React 19, Tailwind v4, `@/ui`.

**Spec:** `docs/superpowers/specs/2026-11-02-mesa-de-noche-design.md`. Requires the Foundation and Media plans.

**Visual reference:** `docs/prototype/designs/b-mesa-de-noche.html#page:edit`, then `#page:edit,insp:file`

## File Tree

`+` is a new file, `~` is an edited file and `-` is a removed file.

```
cloudy-clip/
├─ docs/
│  └─ ~ modules.md                       inspector requires media
└─ src/
   ├─ modules/
   │  ├─ composition/ui/
   │  │  └─ ~ CompositionTabs.tsx
   │  ├─ inspector/
   │  │  ├─ ~ README.md
   │  │  ├─ ~ inspector.module.ts        requires media
   │  │  └─ ui/
   │  │     ├─ ~ FieldItem.tsx
   │  │     ├─ - InfoSection.tsx         replaced by the File section
   │  │     ├─ ~ InspectorHeader.tsx     no title
   │  │     ├─ ~ InspectorPanel.tsx
   │  │     ├─ ~ InspectorTabs.tsx
   │  │     ├─ ~ ResetButton.tsx
   │  │     ├─ ~ SubSection.tsx
   │  │     ├─ ~ TabBody.tsx
   │  │     ├─ ~ TimingSection.tsx       gains the Track row
   │  │     └─ ~ sections.ts             File and Metadata sections
   │  ├─ preview/
   │  │  ├─ ~ README.md
   │  │  ├─ ~ preview.module.ts
   │  │  └─ ui/
   │  │     ├─ + FieldGuide.tsx          field guide and corner marks
   │  │     ├─ ~ PlayButton.tsx
   │  │     ├─ ~ PreviewStage.tsx
   │  │     ├─ ~ Timecode.tsx
   │  │     ├─ ~ Transport.tsx
   │  │     └─ ~ ViewerZoom.tsx
   │  ├─ sticker/ui/
   │  │  ├─ ~ StickerHome.tsx
   │  │  ├─ ~ StickerTile.tsx
   │  │  └─ ~ StickersPanel.tsx
   │  ├─ text/ui/
   │  │  └─ ~ TextPanel.tsx
   │  ├─ timeline/
   │  │  ├─ ~ README.md
   │  │  ├─ ~ timeline.layout.ts         only if the peg bar changes the lanes' offset
   │  │  └─ ui/
   │  │     ├─ ~ ClipBody.tsx
   │  │     ├─ ~ CreateTiles.tsx
   │  │     ├─ ~ CutPreviewMark.tsx
   │  │     ├─ ~ JunctionChip.tsx        red X mark
   │  │     ├─ + PegBar.tsx
   │  │     ├─ ~ Playhead.tsx
   │  │     ├─ ~ Ruler.tsx
   │  │     ├─ ~ TimelineClip.tsx        red-pencil outline
   │  │     ├─ ~ TimelinePanel.tsx
   │  │     ├─ ~ TimelineToolbar.tsx
   │  │     ├─ ~ TrackHeader.tsx
   │  │     └─ ~ TrackLane.tsx           exposure-sheet rows
   │  └─ transition/ui/
   │     ├─ ~ PresetTile.tsx
   │     └─ ~ TransitionsPanel.tsx
   └─ ui/styles/
      └─ ~ tokens.css                    clip fills
```

## Global Constraints

- Follow `CLAUDE.md`. Rule 24: playhead, drag and trim feedback stay direct DOM writes. Rule 26: the timeline stays virtualized.
- Clip positions on screen and on the canvas keep coming from the same layout constants and `clipPlacement()`. Don't change track heights or `HEADER_WIDTH` without checking hit tests.
- Keep every real control that the prototype doesn't show, such as Unlink, Add track, the zoom slider and the agent playheads.
- Done means `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
- Commits have no Co-Authored-By line.
- No new tests: this is styling (rule 3).

## Review Focus

- Long timeline with hundreds of clips: scrolling and playback must stay as smooth as before. Box shadows on clips are the likely cost, so prefer borders.
- Corner marks and the field guide must follow viewer zoom and pan, and must never appear in `preview_capture_frame` or in an export.
- The selected-clip outline must stay visible over poster filmstrips, on linked pairs, and above agent pointers.
- Text, sticker, multi-selection, junction and project views of the inspector all still work, not only a media clip.
- A clip with no file (text, sticker, solid) has a File tab with Timing only, and doesn't break.

---

### Task 1: Library panels

**Files:**

- Modify: `src/modules/text/ui/TextPanel.tsx`, `src/modules/sticker/ui/StickersPanel.tsx`, `StickerHome.tsx`, `StickerTile.tsx`, `src/modules/transition/ui/TransitionsPanel.tsx`, `PresetTile.tsx`, `src/modules/timeline/ui/CreateTiles.tsx`

- [ ] **Step 1: Restyle**

Match the prototype's `.preset`, `.sticker`, `.tr-card`, `.group-title`. Hover uses a 1.5px `--primary` outline, and a used transition uses `--mark`. Check the rail labels fit at 78px: Media, Text, Stickers, Transitions. Keep the current panel order.

- [ ] **Step 2: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. Tiles still drag and apply in the app.

```bash
git add src/modules
git commit -m "feat(editor): library panels in the Mesa look"
```

### Task 2: Preview

**Files:**

- Create: `src/modules/preview/ui/FieldGuide.tsx`
- Modify: `src/modules/preview/ui/PreviewStage.tsx`, `Transport.tsx`, `Timecode.tsx`, `PlayButton.tsx`, `ViewerZoom.tsx`, `src/modules/preview/preview.module.ts`, `README.md`

**Interfaces:**

- Produces: `FieldGuide` as a contribution to `previewOverlays`, id `preview.fieldGuide`.

- [ ] **Step 1: Overlay**

`FieldGuide` draws the prototype's field-guide lines and four red corner marks around the frame. It's DOM above the canvas, positioned the way `TransformOverlay` follows the frame, so it never reaches captures or exports. `pointer-events: none`.

- [ ] **Step 2: Transport**

Timecode in `font-mono`, styled as the prototype's transport row.

- [ ] **Step 3: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. Zoom and pan keep the guide on the frame, and `preview_capture_frame` shows no guide.

```bash
git add src/modules/preview
git commit -m "feat(preview): field guide and corner marks"
```

### Task 3: Timeline

**Files:**

- Create: `src/modules/timeline/ui/PegBar.tsx`
- Modify: `src/modules/timeline/timeline.layout.ts` (only if Step 1 needs it), `src/modules/timeline/ui/TimelinePanel.tsx`, `TimelineToolbar.tsx`, `Ruler.tsx`, `TrackHeader.tsx`, `TrackLane.tsx`, `TimelineClip.tsx`, `ClipBody.tsx`, `Playhead.tsx`, `JunctionChip.tsx`, `CutPreviewMark.tsx`, `src/modules/composition/ui/CompositionTabs.tsx`, `src/ui/styles/tokens.css`, `src/modules/timeline/README.md`

- [ ] **Step 1: Peg bar and sheet**

`PegBar` is static decoration from the prototype's `.pegs`, inside the toolbar area with `aria-hidden`. It must not shift the lanes' top offset in a way the clip gesture doesn't know about; if it does, add its height to `timeline.layout.ts`. Rows of the exposure sheet are a repeating background on the lane, so no new elements are added per page.

- [ ] **Step 2: Clips**

Match the prototype's `.clip`, `.k-video`, `.k-audio`: flat fills, name tags in `font-mono`. Change `--clip-video`, `--clip-audio`, `--clip-type` and `--clip-composition` to fills that sit quietly on `--lane`, keeping them distinct from each other. Add a `--clip-solid` only if a solid clip is otherwise unreadable.

- [ ] **Step 3: Marks**

The selected clip gets the red-pencil outline, drawn with `outline`. The playhead is `--mark`. A junction shows the prototype's red X dissolve mark, with its drag handle keeping the same hit area.

- [ ] **Step 4: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. In the app with a long timeline: move, trim, split, drag a junction, and zoom. Agent playheads still show.

```bash
git add src/modules src/ui/styles/tokens.css
git commit -m "feat(timeline): the exposure sheet"
```

### Task 4: Inspector chrome and Video tab

**Files:**

- Modify: `src/modules/inspector/ui/InspectorPanel.tsx`, `InspectorHeader.tsx`, `InspectorTabs.tsx`, `TabBody.tsx`, `SubSection.tsx`, `FieldItem.tsx`, `ResetButton.tsx`, `src/modules/inspector/README.md`

- [ ] **Step 1: No title**

Remove the title line from `InspectorHeader`. Any clip action it holds moves to the tab strip's right end or stays as a slim row. Tabs keep icons above labels and use `font-hand`; the active tab gets a `--mark` underline. Disabled tabs still show.

- [ ] **Step 2: Rows**

Sections use `FoldSection`, already wired by Foundation, with chevrons. Rows match the prototype's Video tab spacing, label column and reset arrows. Changed values use `text-mark`.

- [ ] **Step 3: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. Walk media, text, sticker, multi-select, junction and project views at 280px and at 360px; nothing clips.

```bash
git add src/modules/inspector
git commit -m "feat(inspector): no title, pencil tabs and rows"
```

### Task 5: File tab

**Files:**

- Modify: `src/modules/inspector/ui/sections.ts`, `TimingSection.tsx`, `src/modules/inspector/inspector.module.ts` (add `media` to `requires`), `README.md`, `docs/modules.md`
- Remove: `src/modules/inspector/ui/InfoSection.tsx`

**Interfaces:**

- Consumes: `FileFactsSection({ mediaId })`, `MetadataSection({ mediaId })` from `@/modules/media`.

- [ ] **Step 1: New sections**

In `builtinSections`, add `inspector.file` (title "File", order 50) and `inspector.metadata` (title "Metadata", order 60) on tab `file`, with `appliesTo: ({ clip }) => clip.mediaId !== undefined`. Keep `inspector.timing`. Remove `inspector.info` and `InfoSection.tsx`, which they replace, but keep the track name by adding a Track row to `TimingSection`.

- [ ] **Step 2: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. Editing Metadata in Edit shows on the Media page and undoes with Ctrl+Z. A text clip's File tab shows Timing only.

```bash
git add src/modules/inspector
git commit -m "feat(inspector): File tab with file facts and metadata"
```
