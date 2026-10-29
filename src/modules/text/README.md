# text

Text over the video. The **Text** tab in the side rail adds a text at the playhead ("Add text", or
a click on the tile) or where the tile is dropped on the timeline. A text clip shows the words
"Text" in one default style (bold, white, soft shadow); it sits on a video track above the
pictures, is moved, trimmed, split and deleted like any clip, and is moved, scaled and rotated in
the preview with the transform tools.

- **Tier:** feature
- **Requires:** `project`, `preview` (the playhead), `timeline` (tracks, placement checks, drop
  targets), `transform` (presets that place the text), `fonts` (weight checks)
- **Contributes:** panel `text.panel` (side, icon `Type`)
- **Points it owns:** —
- **API:** none beyond its exported command (`TextApi` is empty)
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
- **Not yet:** the style UI, animations, auto captions.

| Command            | MCP tool            | Notes                                                                              |
| ------------------ | ------------------- | ---------------------------------------------------------------------------------- |
| `text.add`         | `text_add`          | `start` (default playhead), `duration` (3 s), `trackId`, `text`, `preset`, `style` |
| `text.setText`     | `text_set_text`     | `text.clip_not_found`, `text.not_text`, `text.empty`                               |
| `text.setStyle`    | `text_set_style`    | `clipIds`, partial `style`; `text.weight_unavailable` for known families           |
| `text.applyPreset` | `text_apply_preset` | `title`, `highlight`, `outline`, `pop`, `lower-third` (also moves)                 |
