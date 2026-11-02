# element

Kinds of clip. Every kind (media, text, a plugin's sticker) is an **element**, declared once with
`defineElement`: its properties (values with ranges, defaults and hints for the panel), an
optional panel layout, how it is drawn and measured, how it shows on the timeline and how it is
created. Validation, defaults, the inspector panel and the MCP description come from that
declaration, and one command changes any element's values.

- **Tier:** core
- **Requires:** `project`
- **Contributes:** —
- **Points it owns** (`element.points.ts`): `elements` (keyed by `kind`), `sharedGroups` (by `id`,
  e.g. transform), `propTypes` (by `name`, e.g. font). Read by the registry (`ElementApi`).
- **API:** `ElementApi` (`element.registry.ts`): `get(kind)` → `ResolvedElement` (definition,
  supported groups narrowed by `except` and overrides, every field by path, the patch schema),
  `list()`, `resolve(clip, format)` (stored props over the defaults, plus each group's values under
  its key), `warn(message)` (logs once per kernel). Worked out once, kept until a point changes.
- **Files:**
  - `element.types.ts`: `ElementDefinition`, `PropSpec`, `SharedGroup`, `PropType`, layout items,
    `CustomProps`/`CustomValues` (custom prop types extend them with `declare module`).
  - `logic/props.ts`: the `prop.*` builders and `defaultControl` (string → text/textarea, number →
    number, boolean → toggle, color → color, enum → segmented up to 4 values else select, custom →
    its type's control; a spec's own `control` wins).
  - `logic/schema.ts`: `patchSchema`: every field optional, groups partial, unknown keys refused,
    colors `#rrggbb` lowercased, `trim` strings trimmed before `min`; shared groups under their key.
  - `logic/values.ts`: `mergeProps` (one level deep), `resolveProps`, `minimizeProps` (only what
    differs from the defaults; empty groups dropped), `getPath`, `deepEqual`.
  - `logic/groups.ts`: `narrowGroup`. An element's `"<key>.<field>"` property narrows a shared
    field: only `label`, `control`, `ui`, `display`, `hidden`, `readOnly`, `min`, `max`, with
    `min`/`max` kept inside the group's range; anything else is ignored with a warning.
  - `logic/apply.ts`: what `element.setProps` / `element.resetProps` write. Props are merged over
    the resolved values, run through the element's `normalize`, then minimized. A group's values
    are merged over its defaults, run through its `normalize`, and removed when equal to the
    defaults (an untouched transform stays unset). A patch of shared groups only leaves the props
    alone (the element's `normalize` doesn't run). A reset's props also go through `normalize`
    (with an empty patch) and are minimized; several paths of one group add up.
  - `element.guards.ts` (exported): `parsePatch` (schema + `read_only`), `checkGroupsApply`
    (a group on a track it doesn't apply to), `checkResetPaths` (unknown path →
    `invalid_props`, read-only → `read_only`).
  - Both commands write only the clips whose values really change; when none does they don't
    mutate, so no undo step is added.
- **Values:** `clip.props` holds only what differs from `defaults(format)`, so a value the clip
  doesn't store follows the project's format. Shared group values live under their own key
  (`clip.transform`).
  - **Missing value types:** a `custom` prop whose type isn't in `propTypes` parses as `z.never()`
    ("value type … is not registered"), so no value is accepted, and the registry logs once
    `element "<kind>": value type "<name>" for "<path>" is not registered (is its module loaded?)`.
  - `picture.ready(props, { time })` (optional): whether `draw` can paint now. The engine holds the
    frame while it says no, as for a video frame still decoding (rule 22); asking may start loading,
    and it must say yes once loading has failed. `DrawEnv.time` is the time since the clip started.
  - `DrawEnv.ensureFont` takes a `FaceRequest` (family, source, weight, style), a structural type
    that `fonts`' `FontRequest` fits, so `element` doesn't import `fonts`.
  - `logic/commands.ts`: `checkPanelCommand`, `layoutCommands(element)` (the command ids in its
    layout and its groups' sections, once each).
  - A section's `tab` names the inspector tab it shows in and is passed through as is. A `row` item's
    `label` names the whole row. `ElementApi.defaults(kind, format)`: what `resolve` gives for a clip
    that stores nothing, shared groups included.
  - `logic/layout.ts`: `resolveLayout(source, controlOf)` (source: a `LayoutSource`, so other property trees like a junction kind's use it too; fields from `indexFields`, `logic/fields.ts`) → sections + issues. Without a
    `layout`: "General" (top-level fields, order 0), then one section per group (order 10, 20, …,
    its toggle in the header), then each supported shared group's own section (its `layout` with
    paths under its key, or its fields; at its `order`, transform 900) unless the layout placed the
    group whole. A group alone in a section takes it over; next to other items it is a sub-section;
    `{ group, items }` shows only those fields; `{ title, items }` is an explicit sub-section; a
    sub-section inside one is shown flat (issue). Unknown paths are skipped and paths placed twice
    (outside a `row`) ignored (issues); a path in a `row` may be placed once more outside. A color
    that names an `opacity` sibling places it too (the color's field edits both), so groups don't
    list the sibling and listing it again is "placed twice". Forgotten properties go to "Other"
    (order 10000, issue). `controlOf` is a `LayoutControlOf` (`element.types.ts`).
    Hidden fields never show. Labels default to `labelOf(path)`.
  - `logic/commands.ts`: `checkPanelCommand(id, command)`: placeable when it exists and takes
    `clipIds` (an array) plus at most one field; else `missing`, `no_clip_ids` or
    `too_many_fields`, each with a message for the log and the panel's warning row.
  - `logic/measure.ts`: `canvasTextMeasure(ctx)`, a `TextMeasure` over a 2D canvas (removes the
    trailing letter spacing the canvas adds; letter by letter without `ctx.letterSpacing`). The
    engine draws and the canvas tools hit-test with it.
- **Elements so far:** `media` (media module), `text` (text module), `sticker` (sticker module).
- **Creation:** an element's `create` entries (`{ panel, id, label, props?(format) }`) are shown by
  the timeline's `CreateTiles` and added with `timeline.addElement`.
- **Not yet:** saving projects (`version` migrations), lists of groups, keyframes.

| Command              | MCP tool              | Notes                                                                                                                                           |
| -------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `element.setProps`   | `element_set_props`   | `clipIds` (one kind), `patch`. `element.clip_not_found`, `mixed_kinds`, `unknown_kind`, `invalid_props`, `read_only`                            |
| `element.resetProps` | `element_reset_props` | `clipIds`, optional `paths` (fields, groups, or shared group keys); without paths every prop. `invalid_props`, `read_only`                      |
| —                    | `element_describe`    | every element: name, tracks, source, supports, JSON schema of the patch, defaults for the format, `commands` (panel commands, `layoutCommands`) |
