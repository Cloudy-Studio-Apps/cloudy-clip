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
    defaults (an untouched transform stays unset).
- **Values:** `clip.props` holds only what differs from `defaults(format)`, so a value the clip
  doesn't store follows the project's format. Shared group values live under their own key
  (`clip.transform`).
- **Not yet:** layouts (`resolveLayout`), drawing through elements, creation.

| Command              | MCP tool              | Notes                                                                                                                |
| -------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `element.setProps`   | `element_set_props`   | `clipIds` (one kind), `patch`. `element.clip_not_found`, `mixed_kinds`, `unknown_kind`, `invalid_props`, `read_only` |
| `element.resetProps` | `element_reset_props` | `clipIds`, optional `paths` (fields, groups, or shared group keys); without paths every prop                         |
| —                    | `element_describe`    | every element: name, tracks, source, supports, JSON schema of the patch, defaults for the format                     |
