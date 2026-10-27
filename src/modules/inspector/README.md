# inspector

The right column of the editor. With nothing selected it shows the project (resolution, frame rate,
clip count), how to connect an agent over MCP, and a tip from the seal; with one clip, its
transform, timing, track and file; with several, which ones.

- **Tier:** feature
- **Requires:** `project`, `timeline` (the selection), `transform` (the Reset button)
- **Contributes:** panel `inspector.panel` (inspector slot)
- **Points it owns:** —
- **API:** none (`InspectorApi` is empty)
- **Files:** `ui/InspectorPanel.tsx` picks the view (`ProjectView`, `ClipView`, `MultiView`);
  `InspectorHeader`, `InspectorSection` (collapsible) and `InfoList` are shared by them;
  `TransformSection` shows the clip's transform and runs `transform.setClipTransform` to reset it.
- **Not yet:** editable fields (position, scale, volume, speed) as commands; tabs per clip kind.

No commands or MCP tools of its own: agents read the same data with `project_get_state`.
