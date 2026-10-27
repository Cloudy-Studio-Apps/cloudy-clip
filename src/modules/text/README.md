# text

Text over the video. The **Text** tab in the side rail adds a text at the playhead ("Add text", or
a click on the tile) or where the tile is dropped on the timeline. A text clip shows the words
"Text" in one default style (bold, white, soft shadow); it sits on a video track above the
pictures, is moved, trimmed, split and deleted like any clip, and is moved, scaled and rotated in
the preview with the transform tools.

- **Tier:** feature
- **Requires:** `project`, `preview` (the playhead), `timeline` (tracks, placement checks, drop
  targets)
- **Contributes:** panel `text.panel` (side, icon `Type`)
- **Points it owns:** —
- **API:** none beyond its exported command (`TextApi` is empty)
- **Files:**
  - `text.commands.ts`: `text.add`. Without a track it uses the top video track with room at that
    time, or opens a new top video track (in the same undo step).
  - `ui/TextPanel.tsx`: the tab; `ui/text.gesture.ts`: click-or-drag on the tile (DOM ghost, no
    renders), dropping through `TimelineApi.dropTarget`.
  - The clip itself (`TextClip`), its style and its box (`textBox`) live in `project`, so the
    preview draws it and the canvas tools hit-test it from the same numbers.
- **Not yet:** editing the words, fonts, colors, sizes, alignment, styles/presets, animations,
  auto captions.

| Command    | MCP tool   | Notes                                                   |
| ---------- | ---------- | ------------------------------------------------------- |
| `text.add` | `text_add` | `start` (default playhead), `duration` (3 s), `trackId` |
