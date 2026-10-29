# text

Text over the video. The **Text** tab in the side rail adds a text at the playhead ("Add text", or
a click on the tile) or where the tile is dropped on the timeline. A text clip shows the words
"Text" in one default style (bold, white, soft shadow); it sits on a video track above the
pictures, is moved, trimmed, split and deleted like any clip, and is moved, scaled and rotated in
the preview with the transform tools. Selecting a text clip shows six sections in the inspector to
edit its words and look.

- **Tier:** feature
- **Requires:** `project`, `preview` (the playhead), `timeline` (tracks, placement checks, drop
  targets), `transform` (presets that place the text), `fonts` (weight checks, family list), `inspector`
  (the sections point)
- **Contributes:** panel `text.panel` (side, icon `Type`); inspector sections, all for `kind === "text"`:
  `text.content` (10: words + preset row), `text.font` (20: family picker, size, weight, italic,
  letter and line spacing, align, uppercase), `text.fill` (30), `text.outline` (40),
  `text.background` (50), `text.shadow` (60); preview overlay `text.editor` (in-place editing)
- **Points it owns:** —
- **API:** `TextApi.recents`: the recent colors (`store` of `{ colors }`, `push(color)`), per kernel,
  saved in `localStorage` key `cloudy-clip.colors.recent` (max 12)
- **Files:**
  - `text.add.command.ts`: `text.add`. Without a track it uses the top video track with room at that
    time, or opens a new top video track (in the same undo step). Optional `text`, `preset`, `style`
    (applied as default, preset, style).
  - `text.style.commands.ts`: `text.setText`, `text.setStyle`, `text.applyPreset`. All clips are
    validated before the one mutation; `applyPreset` runs `transform.setClipTransform` nested, so
    it is one undo step. `text.commands.ts` lists them.
  - `text.schema.ts`: Zod for the style patch (ranges, `#rrggbb` lowercased).
  - `logic/presets.ts`: `presetStyle` / `presetTransform` (sizes are fractions of the short side).
    The lower third deviates from "bottom-left safe area": commands can't measure text, so it sets
    `align: "left"` and a transform of `x = -0.2*width`, `y = 0.32*height`.
  - `ui/TextPanel.tsx`: the tab; `ui/text.gesture.ts`: click-or-drag on the tile (DOM ghost, no
    renders), dropping through `TimelineApi.dropTarget`.
  - The clip itself (`TextClip`), its style (`TextStyle`) and its box (`textBox`) live in `project`, so the
    preview draws it and the canvas tools hit-test it from the same numbers.
  - `text.recents.store.ts` / `logic/recents.ts` (`pushRecent`): the recent colors.
  - `logic/fontpick.ts`: `pickVariant` (keep the weight/italic if the family has it, else
    `closestVariant`), `availableWeights`, `hasItalic`, `visibleWindow` (the rows the font list
    renders). `logic/patch.ts`: `mergePatch`.
  - `ui/text.live.hook.ts`: `useTextLive(clip)`. **Live editing:** a drag step calls
    `input(patch)`, which only runs `PreviewApi.previewTextClip(id, { style })` (a patch merged over
    the saved style; no React state). The release (or a toggle, segment, preset, swatch or typed
    value) calls `commit(patch)`: one `text.setStyle` with everything input so far, skipped when
    nothing changes, then the override is cleared. The words work alike (`inputText`,
    `commitText` on blur or Ctrl/Cmd+Enter; empty words revert). A drag is one undo step.
  - `ui/Text*Section.tsx`: the six sections (the inspector supplies each one's collapsible
    frame); `StyleSlider` / `StyleColor` wrap the kit fields with the live hook. `FontPicker` is a
    popover; `FontList` shows only the rows in view (fixed 28 px rows) over the families, with search,
    and `FontRow` shows the source and a "Missing" note. The family button shows
    "Missing — showing Inter" while `fonts.status(...)` is `missing` (re-rendered by `fonts.onLoaded`).
  - `ui/TextEditOverlay.tsx` / `ui/TextEditor.tsx`: **editing on the canvas.** Double-clicking the
    selected text in the frame (its first click selected it) opens a transparent `textarea` over it
    with the clip's font, size, color, alignment and spacing, scaled by clip scale x viewer zoom and
    rotated with the clip (placed from `textLayout` + `clipPlacement`, straight on the DOM, no
    renders while typing or zooming). While open, the canvas text is hidden with a live style
    (`EDIT_HIDDEN_STYLE`: no fill, shadow, outline or background; same size, so the box does not
    move) and the typed words are previewed; a layer covers the frame so the transform tools see no
    pointer (the overlay is contributed after transform's, so it sits on top). Enter adds a line.
    Escape, blur or a click outside end the edit through `logic/editing.ts` `editCommitAction`:
    unchanged does nothing, blank reverts to the old words, else one `text.setText` (one undo step).
- **Presets:** `title`, `highlight`, `outline`, `pop`, `lower-third` (sizes are fractions of the
  frame's short side, stored as output px). **Lower third deviation:** the spec asks for a
  bottom-left safe area, but commands can't measure text (no DOM in the command layer or node
  tests), so the preset sets `align: "left"` and a transform of `x = -0.2*width`,
  `y = +0.32*height`. The text is therefore not exactly left-anchored.
- **Not yet:** in/out/loop animations; styling single words (rich text); gradient fills; curved
  text; keyframes; auto captions; vertical alignment and wrapping boxes; exporting fonts with a
  project; an exact left-anchored Lower third.

| Command            | MCP tool            | Notes                                                                              |
| ------------------ | ------------------- | ---------------------------------------------------------------------------------- |
| `text.add`         | `text_add`          | `start` (default playhead), `duration` (3 s), `trackId`, `text`, `preset`, `style` |
| `text.setText`     | `text_set_text`     | `text.clip_not_found`, `text.not_text`, `text.empty`                               |
| `text.setStyle`    | `text_set_style`    | `clipIds`, partial `style`; `text.weight_unavailable` for known families           |
| `text.applyPreset` | `text_apply_preset` | `title`, `highlight`, `outline`, `pop`, `lower-third` (also moves)                 |
