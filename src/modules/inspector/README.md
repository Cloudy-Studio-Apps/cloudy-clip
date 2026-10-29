# inspector

The right column of the editor. With nothing selected it shows the project (resolution, frame rate,
clip count), how to connect an agent over MCP, and a tip from the seal; with one clip, the panel
generated from its element, then timing, track and file (clips without a file show no file; a
linked picture + sound counts as one clip: the one clicked, via the timeline's
`selectionSubject`); with several, which ones.

- **Tier:** feature
- **Requires:** `project`, `element` (layouts, values, `element.setProps`), `preview` (live props),
  `timeline` (the selection)
- **Contributes:** panel `inspector.panel` (inspector slot); the built-in controls and the
  `section` layout to its own points
- **Points it owns** (`inspector.points.ts`, read by `ElementPanel`):
  - `propertyControls` (keyed by `id`): `{ id, for: "field", component }` gets `FieldControlProps`
    (`clip`, `path`, `spec`, `value`, `values`, `label`, `disabled`, `live`); `{ id, for:
"command", component }` gets `CommandControlProps` (`clipIds`, `commandId`, `field?`, `label`,
    `icon?`, `run(input)`). Built in (`ui/controls/`): `text`, `textarea`, `number`, `slider`,
    `dial` (a number box for now), `toggle`, `icon-toggle`, `color` (with the sibling opacity the
    spec names), `segmented`, `select`; for commands `button` and `choices` (one button per enum
    value).
  - `sectionLayouts` (keyed by `id`): `{ id, component }` gets `SectionLayoutProps` (`section`,
    `clip`, `values`, `live`, `renderItem`). Built in: `section` (`ui/PanelSection.tsx`):
    collapsible, the group's toggle as a `Switch` in the header, items only while it is on.
- **API:** `InspectorApi.recents`: the recent colors of every color field (`store` of `{ colors }`,
  `push(color)`), per kernel, saved in `localStorage` key `cloudy-clip.colors.recent` (max 12;
  `inspector.recents.store.ts`, `logic/recents.ts`). Exported for custom controls:
  `usePropsLive(clip)`, `FieldRow`, `pathPatch`.
- **Files:** `ui/InspectorPanel.tsx` picks the view (`ProjectView`, `ClipView`, `MultiView`);
  `InspectorHeader` and `InspectorSection` (collapsible, optional header `actions`) are shared by
  them; `InfoList` comes from `@/ui`. The header shows the clip's element `display`.
  - `ui/ElementPanel.tsx`: `resolveLayout` of the clip's element (controls by `defaultControl`,
    custom types' control from `propTypes`), memoized per resolved element; values resolved once
    per clip change. Shared group sections whose `appliesTo` is false for the clip are left out.
    Each section is drawn by its layout from `sectionLayouts`, each item by `renderItem`: fields
    (`FieldItem`, hidden by `visibleWhen`, disabled by `readOnly`/`enabledWhen`), rows, sub-sections
    (`SubSection`: with a toggle, a `ToggleRow` showing its fields while on), commands
    (`CommandItem`).
  - `ui/CommandItem.tsx`: `checkPanelCommand(id, bus.get(id))`; the control is the item's
    `control`, else `button` (no field) or `choices` (an enum field). Runs `bus.execute(id, {
...input, clipIds: [clip.id] })`.
  - **Missing pieces never break the panel:** an unknown command, control, section layout or
    element shows a `WarningRow` in place ("… isn't available." / "… can't be shown." with the
    reason) and is logged once per kernel (`useWarnOnce` → `ElementApi.warn`); layout issues from
    `resolveLayout` are logged the same way.
  - `logic/display.ts` (`toDisplay`/`fromDisplay`: opacity 0–1 shown as %), `logic/conditions.ts`
    (`isVisible`, `isEnabled`), `logic/paths.ts` (`pathPatch("outline.width", 4)` →
    `{ outline: { width: 4 } }`).
  - `logic/live.ts`: `createPropsLive({ preview, read, commit })`: `input(patch)` merges into the
    pending patch and only redraws (`PreviewApi.previewProps`); `commit(patch)` sends one
    `element.setProps` with everything input so far, skipped when `livePatchChanged` says nothing
    differs from the resolved values (or the clip is gone), then clears the preview; `dispose`
    clears without committing (clip deleted or deselected mid-drag). `ui/props.live.hook.ts`:
    `usePropsLive(clip)` wraps it per clip and disposes on unmount.
- **Not yet:** a real dial; tabs; editing several selected clips at once.

No commands or MCP tools of its own: agents read the same data with `project_get_state` and
change it with `element_set_props`.
