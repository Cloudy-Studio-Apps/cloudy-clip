# text

Text over the video. The **Text** tab in the side rail adds a text at the playhead (a click on a
tile) or where the tile is dropped on the timeline. A text clip shows the words
"Text" in one default style (bold, white, soft shadow); it sits on a video track above the
pictures, is moved, trimmed, split and deleted like any clip, and is moved, scaled and rotated in
the preview with the transform tools. Selecting a text clip shows its panel, generated from the
text element: Content, Font, Fill, Outline, Background, Shadow, then Transform.

- **Tier:** feature
- **Requires:** `project`, `element` (the text element, `element.setProps`), `preview` (the
  playhead, live props), `timeline` (`addElement`, `CreateTiles`), `transform` (the
  shared group presets place), `fonts` (face checks against `knownFamilies()`, family list),
  `inspector` (`propertyControls`, `usePropsLive`)
- **Contributes:** element `text`; controls `font-picker`, `font-weight`, `font-italic` (fields)
  and `preset-row` (command); panel `text.panel` (side, icon `Type`); preview overlay
  `text.editor` (in-place editing)
- **Points it owns:** —
- **API:** none (`TextApi` is empty). Exports `textElement`, `applyTextPreset`, `presetStyle`,
  `presetTransform`, `textLayout`.
- **Files:**
  - `text.element.ts`: `textElement` (`textProperties`: words, `font` (custom prop), size, weight,
    italic, letter and line spacing, align, uppercase, fill, outline, background, shadow, with the
    stored ranges and the sliders' ranges as `ui`); defaults `{ text: DEFAULT_TEXT,
...defaultTextStyle(format) }`; `normalize` = `checkExplicitFace` (`logic/faces.ts`: fails
    `text.weight_unavailable` / `text.italic_unavailable` when the patch itself names a face the
    family lacks) then `snapStyleToFamily`; supports `transform`; `picture: { fit: "none", size:
textLayout(…).box, draw: drawText }`. A clip's `props` hold only what differs from the
    defaults. Only families in `fonts.knownFamilies()` are checked (never waits for the network).
  - `text.panel.ts`: `textPanelLayout`: Content (`text` + the `text.applyPreset` command as
    `preset-row`), Font (`font`, a row of weight / italic / uppercase, size, align, sub-section
    Spacing), then the fill, outline, background and shadow groups (their switch in the header).
  - `text.preset.command.ts`: `text.applyPreset` (`clipIds`, `preset`): per clip one nested
    `element.setProps` with the preset style, its face snapped to the family first, and, for the
    lower third, the `transform`. All clips in one undo step.
  - `text.schema.ts`: `textPresetId`, the preset names for `text.applyPreset`'s input.
  - Creating: the element's `create` entries for panel `text`: **Text** (default look),
    **Title** (the title preset), **Lower third** (the preset plus its transform). The Text tab
    shows them with the timeline's `CreateTiles`; the tiles run
    `timeline.addElement` (kind `text`), which puts the clip on the top video track with room or a
    new one, at the playhead or the drop point.
  - `logic/layout.ts`: `DEFAULT_TEXT`, `clipText`, `textStyleOf`, `defaultTextStyle`,
    `mergeTextStyle`, `textFont`, `displayText`, `textPadding`, `textLayout` (lines, box, positions
    from the box center; blank lines keep their height), `textBox`. Types (`TextStyle`,
    `TextProps`, …) are type aliases in `text.types.ts`.
  - `text.draw.ts`: `drawText(ctx, props, env)`: background box, then per line the shadow (first
    painted pass only), outline stroke and fill, at `env.placement`. A font not loaded yet is drawn
    in Inter at the clip's scale.
  - `logic/snap.ts`: `snapStyleToFamily` moves a style's weight/italic to the closest face its
    family has (`closestVariant`). `logic/presets.ts`: `presetStyle` / `presetTransform` (sizes are
    fractions of the short side). `logic/fontpick.ts`: `pickVariant` (keep the weight/italic if the
    family has it, else `closestVariant`), `availableWeights`, `hasItalic`, `visibleWindow` (the rows
    the font list renders).
  - `ui/controls/`: every field control honors `disabled`. `FontPickerControl` (the `FontPicker` popover, whose trigger is disabled with it; picking a family keeps the
    closest face and loads it), `FontWeightControl` (only the weights the family has),
    `FontItalicControl` (disabled when the family has no italic), `PresetRowControl` (one button per
    preset). `FontList` shows only the rows in view (fixed 28 px rows) with search; `FontRow` shows
    the source and a "Missing" note; the family button shows "Missing — showing Inter" while
    `fonts.status(...)` is `missing` (re-rendered by `fonts.onLoaded`).
  - `ui/TextPanel.tsx`: the tab: a heading and `CreateTiles panel="text"` (the **Text** tile is
    the plain add).
  - `ui/TextEditOverlay.tsx` / `ui/TextEditor.tsx`: **editing on the canvas.** Double-clicking the
    selected text in the frame (its first click selected it) opens a transparent `textarea` over it
    with the clip's font, size, color, alignment and spacing, scaled by clip scale x viewer zoom and
    rotated with the clip (placed from `textLayout` + `clipPlacement`, straight on the DOM, no
    renders while typing or zooming). While open, the canvas text is hidden with a live patch
    (`PreviewApi.previewProps` with `EDIT_HIDDEN_STYLE`: no fill, shadow, outline or background;
    same size, so the box does not move) and the typed words are previewed; a layer covers the
    frame so the transform tools see no pointer (the overlay is contributed after transform's, so
    it sits on top). Enter adds a line. Escape, blur or a click outside end the edit through
    `logic/editing.ts` `editCommitAction`: unchanged does nothing, blank reverts to the old words,
    else one `element.setProps` with `{ text }` (one undo step).
- **Presets:** `title`, `highlight`, `outline`, `pop`, `lower-third` (sizes are fractions of the
  frame's short side, stored as output px). **Lower third deviation:** the spec asks for a
  bottom-left safe area, but commands can't measure text (no DOM in the command layer or node
  tests), so the preset sets `align: "left"` and a transform of `x = -0.2*width`,
  `y = +0.32*height`. The text is therefore not exactly left-anchored.
- **Not yet:** in/out/loop animations; styling single words (rich text); gradient fills; curved
  text; keyframes; auto captions; vertical alignment and wrapping boxes; exporting fonts with a
  project; an exact left-anchored Lower third.

| Command               | MCP tool               | Notes                                                                              |
| --------------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| `timeline.addElement` | `timeline_add_element` | (owned by `timeline`) `{ kind: "text", props?, start?, duration?, trackId? }`      |
| `text.applyPreset`    | `text_apply_preset`    | `clipIds`, `preset`: `title`, `highlight`, `outline`, `pop`, `lower-third` (moves) |
| `element.setProps`    | `element_set_props`    | (owned by `element`) words and style: `{ text }`, `{ size, outline: { … } }`, …    |
