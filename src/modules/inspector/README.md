# inspector

The right column of the editor, laid out like DaVinci Resolve's: a strip of icon tabs, sections as
bands with a switch and a reset, rows with a name column and an end column. With nothing selected it
shows the project (resolution, frame rate, clip count), how to connect an agent over MCP, and a tip
from the seal; with one clip, that clip's tabs (a linked picture + sound counts as one clip: the one
clicked, via the timeline's `selectionSubject`, with the partner's sections in the same tabs); with
several, which ones. With one junction selected (the timeline's `junctionSelection`), the junction's
panel, without tabs.

- **Tier:** feature
- **Requires:** `project`, `element` (layouts, values, `element.setProps`), `media` (the File tab), `preview` (live props),
  `timeline` (the selection), `junction` (kinds, `junction.set`/`junction.remove`)
- **Contributes:** panel `inspector.panel` (inspector slot); to its own points, the built-in
  controls, the `section` layout, the tabs Video, Audio, Transition and File, the sections Sound,
  Transition, Timing and Info, and the `reset` field action
- **Points it owns** (`inspector.points.ts`, read by `ElementPanel`):
  - `propertyControls` (keyed by `id`): `{ id, for: "field", component }` gets `FieldControlProps`
    (`clip`, `path`, `spec`, `value`, `values`, `label`, `disabled`, `live`); `{ id, for:
"command", component }` gets `CommandControlProps` (`clipIds`, `commandId`, `field?`, `label`,
    `icon?`, `run(input)`). Built in (`ui/controls/`): `text`, `textarea`, `number`, `slider`,
    `dial` (a number box for now), `toggle`, `icon-toggle`, `color` (with the sibling opacity the
    spec names), `gradient` (`GradientField`), `segmented`, `select`; for commands `button` and `choices` (one button per enum
    value).
  - `sectionLayouts` (keyed by `id`): `{ id, component }` gets `SectionLayoutProps` (`section`,
    `clip`, `values`, `live`, `renderItem`, `enabled(path)`). Built in: `section`
    (`ui/PanelSection.tsx`): collapsible, the group's toggle as a `Switch` in the header (disabled
    when `enabled(header)` is false), items only while it is on.
  - `inspectorTabs` (keyed by `id`): `{ id, label, icon, order, contextual? }`. A tab holds no logic:
    it is available exactly when a section lands in it, else greyed out, or left out when
    `contextual` (Text, Sticker, from their modules). `logic/tabs.ts`: `sectionTab`, `tabStates`,
    `pickTab` (the remembered tab while available, else the first available).
  - `inspectorSections` (keyed by `id`): `{ id, tab, title, order, appliesTo?(context, project),
bare?, component }`, for what isn't a property of an element, so any module can add to any clip's
    panel. Drawn in the standard band unless `bare`. The component gets an `InspectorContext`
    (`clip`, `track`, `partner?`).
  - `fieldActions` (keyed by `id`): `{ id, order, appliesTo?(spec), component }`, the end of a row.
    Gets `FieldActionProps` (`clip`: a `PanelSubject`, also a junction; `paths`, `values`, `defaults?`, `live`, `disabled`). Keyframes (`keyframe` module) go here. A row's wrapper has `data-field-row`; an action may set `data-key-state` on it (`off`, `animated`, `on-key`) and the row's inputs take `text-on` / `text-mark`.
  - A section of an element or shared group picks its tab with `tab` in its `LayoutSection`
    (`"video"` when it names none). A tab that isn't registered is warned about once and the section
    lands in the first tab, so no property is lost.
  - Every built-in field control passes `disabled` (read-only or `enabledWhen` false) to its kit
    field, so a disabled field can't send a command.
- **API:** `InspectorApi.view`: the tab per clip kind and the folded sections, per kernel and never
  in history (`inspector.view.store.ts`). `InspectorApi.recents`: the recent colors of every color field (`store` of `{ colors }`,
  `push(color)`), per kernel, saved in `localStorage` key `cloudy-clip.colors.recent` (max 12;
  `inspector.recents.store.ts`, `logic/recents.ts`). Exported for custom controls:
  `PanelSubject` (a clip or a junction, what a panel is about), `ClipTabSections({ tab, fallback? })` (the selected clip's sections of one tab, drawn as here, for a page without the inspector: the Sound page's Clip tab), `usePropsLive(clip)`, `useClipAtPlayhead(clip)` (the clip with its keyed values at the playhead), `FieldRow`, `InspectorSection`, `pathPatch`.
- **Files:** `ui/InspectorPanel.tsx` picks the view (`ProjectView`, `ClipView`, `MultiView`);
  `InspectorHeader` (project, junction and multi-select views; a clip shows no title) and `InspectorSection` (the band: `foldKey`, `leading` slot for a switch,
  `actions`, its fold state in `InspectorApi.view`) are shared by them; `InfoList` comes from `@/ui`.
  The header shows the clip's element `display`.
  - `ui/ClipView.tsx`: the header, `InspectorTabs` and `TabBody`; `ui/clip.context.hook.ts` (`useClipContext`: the clip, its track and partner). `ui/ClipTabSections.tsx`: the selection subject (as `InspectorPanel`), then `useClipPanel(context, tab)` and `TabBody` for that one tab. `ui/clip.panel.hook.ts`
    (`useClipPanel`, with an optional fixed tab): reads the `elements` point, so an element registered after the panel opened
    shows; `panelLayout` (`logic/layout.ts`: `resolveLayout`, controls by `defaultControl`, custom
    types' control from `propTypes`) of the clip and its partner, memoized per kind. Shared group
    sections whose `appliesTo` is false for that clip are left out. Merges those with
    `inspectorSections`, grouped by tab and sorted by `order`.
  - `ui/ClipSection.tsx`: one section of an element, values resolved once per clip change.
    `ui/PropertySection.tsx`: draws a section by its layout from `sectionLayouts`, each item by
    `renderItem`: fields (`FieldItem`, hidden by `visibleWhen`, disabled by
    `readOnly`/`enabledWhen`), rows, sub-sections (`SubSection`: with a toggle, a `ToggleRow` showing
    its fields while on), commands (`CommandItem`).
  - **Rows:** `FieldRow` is the name column and the control. The end column is drawn by `FieldItem`
    (or the row), not by controls, so a custom control gets it without doing anything, and a control
    with several rows (sticker variations) gets one. In a row with a `label`, `field.context.ts`
    tells fields to drop their name; a number then shows it as a prefix that scrubs.
  - **Reset:** `live.reset(paths)` (`PropsLive`), one undo step, for a row (`ui/ResetAction.tsx`) or a
    section's band. Clips run `element.resetProps`, because a merge can't remove keys of an object
    value (a sticker's variation). `logic/reset.ts`: the paths of an item or section (a color with
    its opacity; a section leaves out its header's switch and the user's words), `differs`. Junctions
    have no `reset`: `junction.set` can't clear an object value, so they show none.
  - `ui/sections.ts`: the built-in `inspectorSections`, with `SoundSection`, `JunctionsSection`
    (each junction of the clip as `JunctionBody`, titled by side), `FileSections` (the File tab's File and Metadata, from `media`), `TimingSection`.
  - `ui/CommandItem.tsx`: `checkPanelCommand(id, bus.get(id))`; the control is the item's
    `control`, else `button` (no field) or `choices` (an enum field). Runs `bus.execute(id, {
...input, clipIds: [clip.id] })`.
  - **Missing pieces never break the panel:** an unknown command, control, section layout,
    value type (a `custom` field whose `propTypes` entry is missing) or element shows a `WarningRow` in place ("… isn't available." / "… can't be shown." with the
    reason) and is logged once per kernel (`useWarnOnce` → `ElementApi.warn`); layout issues from
    `resolveLayout` are logged the same way.
  - `logic/display.ts` (`toDisplay`/`fromDisplay`: opacity 0–1 shown as %), `logic/conditions.ts`
    (`isVisible`, `isEnabled`), `logic/paths.ts` (`pathPatch("outline.width", 4)` →
    `{ outline: { width: 4 } }`).
  - `logic/live.ts`: `createPropsLive({ preview, read, commit })`: `input(patch)` merges into the
    pending patch and only redraws (`PreviewApi.previewProps`); `commit(patch)` sends one
    `element.setProps` with everything input so far, skipped when `livePatchChanged` says nothing
    differs from the resolved values (or the clip is gone), then clears the preview (input made
    while that command runs stays in the preview and goes with the next commit); `dispose`
    clears without committing (clip deleted or deselected mid-drag). `ui/props.live.hook.ts`:
    `usePropsLive(clip)` wraps it per clip and disposes on unmount.
  - `ui/clip.values.hook.ts`: `useClipAtPlayhead(clip)`, the clip with its animated values at the playhead (`animatedClip` at `clampToClip`), which `ClipSection` resolves for its fields. A clip with no `animation` is returned as is and subscribes to nothing; otherwise it follows `playback.onTime` at most every 100 ms while playing and sets state only when a value differs. `usePropsLive` commits `element.setProps` with `at` (the playhead), and reads the values at the playhead, so an animated field writes a key.
  - `ui/PropertyPanel.tsx`: every section of a `LayoutSource` without tabs, for junctions.
    `renderCommand` draws command items (junctions have none: they show as unavailable). Controls
    get a `PanelSubject` (`{ id, kind }`) in `clip`.
  - `ui/JunctionView.tsx`: header with the junction's `display` (a missing kind shows "(not
    available)", no values, still Remove), then `ui/JunctionBody.tsx`: a band with a Duration row in
    seconds (`junction.set { duration }` in integer µs, limits from `durationLimits`, only for kinds
    that overlap) and a Remove button (`junction.remove`); the kind's values through `PropertyPanel`,
    committed by `ui/junction.live.hook.ts` (`createPropsLive` with no preview) as
    `junction.set { junctionIds, patch }`. `logic/junction.ts`: `junctionSetInput`,
    `junctionLayoutSource`.
- **Not yet:** a real dial; editing several selected clips at once; an Effects tab; a switch on
  Transform (it needs an `enabled` value `clipPlacement` and the canvas tools honor).

No commands or MCP tools of its own: agents read the same data with `project_get_state` and
change it with `element_set_props`.

The Audio tab's sound controls come from the `audio` module through `inspectorSections`; this module keeps only the Sound section (track and mute).
