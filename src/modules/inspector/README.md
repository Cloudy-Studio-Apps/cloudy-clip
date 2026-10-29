# inspector

The right column of the editor. With nothing selected it shows the project (resolution, frame rate,
clip count), how to connect an agent over MCP, and a tip from the seal; with one clip, the sections modules contribute (transform, …), timing, track and file (text clips show their words and no file; a linked picture +
sound counts as one clip: the one clicked,
via the timeline's `selectionSubject`); with several, which ones.

- **Tier:** feature
- **Requires:** `project`, `element` (the header: each clip's `display`; `element.setProps`),
  `preview` (live props), `timeline` (the selection)
- **Contributes:** panel `inspector.panel` (inspector slot)
- **Points it owns:** `inspector.sections` (`inspectorSections`, in `inspector.points.ts`): an
  `InspectorClipSection` is `{ id, title, order, appliesTo(clip, track), component }`. `ClipView`
  shows those that apply, sorted by `order`, each wrapped in a collapsible `InspectorSection`
  titled `title`; the component renders only its body. Orders: text 10-60, transform 100.
- **API:** none (`InspectorApi` is empty). Exported hook `usePropsLive(clip)` for fields (also
  text's custom controls).
- **Files:** `ui/InspectorPanel.tsx` picks the view (`ProjectView`, `ClipView`, `MultiView`);
  `InspectorHeader` and `InspectorSection` (collapsible) are shared by them; `InfoList` comes from
  `@/ui`. The header shows the clip's element `display` (icon, color, label).
  - `logic/live.ts`: `createPropsLive({ preview, read, commit })`: `input(patch)` merges into the
    pending patch and only redraws (`PreviewApi.previewProps`); `commit(patch)` sends one
    `element.setProps` with everything input so far, skipped when `livePatchChanged` says nothing
    differs from the resolved values (or the clip is gone), then clears the preview; `dispose`
    clears without committing (clip deleted or deselected mid-drag). `ui/props.live.hook.ts`:
    `usePropsLive(clip)` wraps it per clip and disposes on unmount.
- **Not yet:** editable fields (position, scale, volume, speed) as commands; tabs.

No commands or MCP tools of its own: agents read the same data with `project_get_state`.
