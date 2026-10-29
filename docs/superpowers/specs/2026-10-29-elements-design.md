# Elements: declared properties, generated panels, generic commands

Status: agreed with the user on 2026-10-29. Implementation plan:
`docs/superpowers/plans/2026-10-29-elements.md`.

## Why

A text clip's look is described in four unconnected places: the `TextStyle` type in `project`, the
Zod schema in `text/text.schema.ts`, six hand-written inspector sections with their own slider
ranges (outline width is 0–200 in the schema, 0–100 in the UI), and `defaultTextStyle`. Adding one
property means editing six files, and a plugin cannot add a new kind of clip at all: `project`,
the preview engine, the canvas tools, the timeline and the inspector all branch on
`clip.kind === "text"`.

## The idea in one paragraph

Every kind of clip is an **element**, declared once with `defineElement`: its properties (data
with ranges, defaults and per-field UI hints), an optional layout of the inspector panel, how it
is drawn and measured, how it shows on the timeline, and how it is created. Everything else is
generated from that declaration: validation, defaults, the inspector panel, the MCP description,
the timeline label. One generic command (`element.setProps`) changes any element's properties.
Text and media become elements. A plugin adds a working element (stickers, shapes) without
touching any other module.

## Settled calls

1. **Scope: everything**, including drawing and hit-testing. Text-specific code leaves `project`,
   `preview`, `transform`, `timeline` and `inspector`.
2. **Values live in `clip.props`**, only what differs from the defaults (missing = default).
   `properties` is the declaration (in code); `props` is one clip's values (in the project).
   Shared groups keep their own key on the clip (`clip.transform`). Projects aren't saved yet, so
   no migration.
3. **Shared properties are opt-in with `supports`**: `supports: { transform: { except: ["rotation"] },
opacity: true }`. A shared group (`transform`) is defined once by the module that owns it.
   An element writes `"transform.scale": { ui: { max: 10 } }` in `properties` to narrow a shared
   field (narrow only: range, `ui`, `label`, `control`, `display`; never the type).
4. **Properties and layout are separate, layout optional.** No layout: one "General" section for
   top-level fields, then one section per group, in declaration order. A group named in `items`
   expands to its fields (its `toggle` boolean goes in the header). Alone in a section it takes
   the section over; next to other items it becomes a sub-section. `{ title, items }` nested is an
   explicit sub-section. `{ row: [...] }` puts controls on one line. Two levels at most.
5. **No separate "action" concept.** A button in the panel is a command placed **by id**:
   `{ command: "text.applyPreset", control: "preset-row" }`. A placeable command takes
   `clipIds: string[]` (the panel fills it from the selection) and at most one more field (the
   panel draws a control for it from its Zod type: enum → segmented or the named `control`;
   number/boolean/string → that type's default). Only `clipIds` → a button.
6. **Ids are typed for known commands** (`CommandInputs` interface in `@/core`, extended by each
   module with `declare module`). An id that is unknown at runtime, a command without `clipIds`,
   or one with more than one extra field is **logged once** (`ctx.log.warn`, naming element,
   section and id) and shown in place as a disabled warning row that says what is missing. Same
   fallback for unknown controls, section layouts and prop types. Re-checked when points change.
7. **Old commands are removed**: `text.setStyle`, `text.setText`, `text.add` and their MCP tools,
   and `transform.setClipTransform` (the canvas gesture commits through `element.setProps`).
   `text.applyPreset` stays (a recipe that also moves the clip); `transform.reset` is new (a
   button). New: `element.setProps`, `element.resetProps`, `element_describe`, `timeline.addClip`.
8. **Creation is declared**: `create: [{ panel: "text", id: "title", label: "Title", props: {...} }]`.
   A shared `CreateTiles` component (timeline) shows the entries of one panel id; click adds at the
   playhead, drag drops on the timeline. Both run `timeline.addClip({ kind, props?, start?,
trackId? })`, which has today's `text.add` track rules for any element without a source file.
9. **Drawing goes through the element**: `picture: { fit, size(props, env), draw(ctx, props, env) }`.
   Media keeps its decoder path (`picture: { fit: "contain", source: "media" }`, see the preview
   decoder boundary); every other element is drawn by its own `draw`. An element without
   `picture` (none yet) is never drawn.

## Names

| Thing                         | Name                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| New core module               | `element` (`src/modules/element/`), requires `project`                                                     |
| Declare an element            | `defineElement({...})`                                                                                     |
| Property builders             | `prop.string / number / boolean / color / enum / group / custom`                                           |
| Points (owned by `element`)   | `elements` (keyed by kind), `sharedGroups` (by id), `propTypes` (by name)                                  |
| Points (owned by `inspector`) | `propertyControls` (by id), `sectionLayouts` (by id)                                                       |
| Generic commands              | `element.setProps`, `element.resetProps` (MCP `element_set_props`, `element_reset_props`)                  |
| Describe tool                 | `element_describe` (every element: properties, ranges, units, defaults for the format, placeable commands) |
| Create a clip                 | `timeline.addClip` (MCP `timeline_add_clip`)                                                               |
| Live preview                  | `PreviewApi.previewProps(clipId, patch \| null)`, `propsOverride(id)`, `onPropsOverride(fn)`               |

MCP tool names start with the module id (CLAUDE.md rule 17), so the generic tools are
`element_*`, not `clip_*` as said in conversation.

## Data model (`project`)

```ts
interface Clip {
  id;
  trackId;
  start;
  duration;
  sourceIn; // structure, owned by the timeline
  kind: string; // "media", "text", or a plugin's kind
  props: Record<string, unknown>; // the element's own values (only changed ones)
  mediaId?: MediaId; // elements with a source file (media)
  transform?: ClipTransform; // shared group "transform"
  linkId?: string;
}
```

`project` keeps `ClipTransform`, `clipPlacement`, `clipTransform` (structure + the shared geometry,
rule 22) and loses every text type and helper: they move to `text`. `clipFit` is removed
(the fit comes from the element).

## Element declaration

```ts
interface ElementDefinition<P> {
  kind: string;
  name: string; // "Text"
  // timeline clip + inspector header; color is a token suffix (bg-clip-type)
  display(
    clip: Clip,
    env: { project; track },
  ): { icon; color; label; body: "poster" | "waveform" | "none" };
  source: "media" | "none"; // "none": no source file, any length, sourceIn stays 0
  tracks: TrackKind[]; // where it may sit: text ["video"], media ["video","audio"]
  supports?: { [group: string]: true | { except: string[] } };
  properties: PropertyTree; // prop.* builders; "group.field" keys narrow shared fields
  defaults(format: ProjectFormat): P;
  normalize?(next: P, env: NormalizeEnv): P; // cross-field rules; may throw CommandFailure
  layout?: LayoutSection[];
  picture?: PictureDefinition<P>;
  create?: CreateEntry[];
}
```

`P` is inferred from `properties` (`PropsOf<typeof properties>`), so `textElement.resolve(clip,
format)` returns typed `TextProps`. `resolve` = `defaults(format)` merged with `clip.props`
(groups one level deep, as `mergeTextStyle` did).

### Property builders

Every builder takes optional `{ label, control, ui: { min, max, step }, display: { scale, unit },
hidden, readOnly, visibleWhen, enabledWhen }`.

| Builder                                      | Value     | Default control            | Notes                                                             |
| -------------------------------------------- | --------- | -------------------------- | ----------------------------------------------------------------- |
| `prop.string({ min, max, multiline, trim })` | `string`  | `text` / `textarea`        | `trim: true` + `min: 1` refuses blank                             |
| `prop.number({ min, max, step, unit })`      | `number`  | `number`                   | `control: "slider"` / `"dial"`                                    |
| `prop.boolean()`                             | `boolean` | `toggle`                   | `control: "icon-toggle"` with `icon`                              |
| `prop.color({ opacity })`                    | `#rrggbb` | `color`                    | `opacity: "sibling"` binds a 0–1 sibling to the same `ColorField` |
| `prop.enum(values, { labels })`              | union     | `select` (≤4: `segmented`) |                                                                   |
| `prop.group({ label, toggle }, fields)`      | object    | —                          | one level; `toggle` names a boolean field                         |
| `prop.custom(name, args)`                    | from type | the type's                 | `name` is registered in `propTypes`; typed through `CustomProps`  |

`visibleWhen` / `enabledWhen` are paths to a boolean (`"outline.enabled"`) or
`(props) => boolean`. `hidden`: stored, validated, not in the panel. `readOnly`: shown disabled,
`element.setProps` refuses it.

### Layout items

```ts
type LayoutItem =
  | string // a field or group path
  | { path: string; control?: string; label?: string } // a field with an override
  | { row: LayoutItem[] }
  | { title: string; items: LayoutItem[] } // explicit sub-section
  | { group: string; items: string[] } // a group's header + only these fields
  | { command: PanelCommandId; control?: string; label?: string; icon?: string };
interface LayoutSection {
  title?: string;
  order?: number;
  layout?: string;
  items: LayoutItem[];
}
```

`layout` names a section layout (`"section"` default). Shared groups bring their own section
(`transform` at order 900); an element's layout may place their paths elsewhere. A layout that
leaves a property unplaced (not `hidden`) logs a warning and shows it in an "Other" section; a
path placed twice (outside `row`) is an error, logged, second ignored.

### Pictures

```ts
interface PictureDefinition<P> {
  fit: "contain" | "none";
  source?: "media"; // drawn by the decoder path
  size?(props: P, env: { format; measure: TextMeasure }): PictureSize;
  draw?(ctx: CanvasRenderingContext2D, props: P, env: DrawEnv): void;
}
interface DrawEnv {
  format;
  placement: ClipPlacement;
  kx: number;
  ky: number;
  ensureFont(req): boolean;
}
```

The engine computes `placement = clipPlacement(format, size, transform, fit)` and hands it to
`draw`, so drawing and hit-testing agree (rule 22). The canvas tools use `size` + the live
props override for the box.

## The generic command

`element.setProps({ clipIds, patch })`, undoable:

1. every clip exists (`element.clip_not_found`) and all share one kind (`element.mixed_kinds`);
2. the kind is registered (`element.unknown_kind`);
3. `patch` parses against the element's patch schema (built from `properties`, plus supported
   shared groups under their key): unknown keys, wrong types and out-of-range values fail with
   `element.invalid_props` and the Zod message; `readOnly` fields fail with `element.read_only`;
4. for each clip: next = `normalize(resolve(clip) ⊕ patch)`; stored `props` = next minus the
   defaults (a field equal to its default is dropped, so props stay minimal); shared group values
   go to their key (`clip.transform`) through the group's own `normalize` (rotation);
5. one `ctx.mutate`, one undo step. Returns the clips.

`element.resetProps({ clipIds, paths? })` drops the given paths (or all props) back to defaults.

## Inspector panel

`ClipView` resolves the clip's element, builds sections with `resolveLayout` (pure, tested), and
renders each with its section layout and each field with its control from `propertyControls`.
Timing and Info stay hard-coded. The `inspectorSections` point is removed (its users become
element layouts and `sectionLayouts`).

Live editing is generic (`usePropsLive(clip)`, from `useTextLive`): a drag step calls
`previewProps(id, patch)`, the release one `element.setProps`; skipped when nothing changes.

Built-in controls (inspector): `text`, `textarea`, `number`, `slider`, `dial`, `toggle`,
`icon-toggle`, `color`, `segmented`, `select`, `button`. Text contributes `font-picker` and
`preset-row`; fonts contributes the `font` prop type.

## Out of scope

Saving projects and `version` migrations; shared groups other than `transform` (opacity, audio, speed come with their features); keyframes; lists of groups (several shadows); depth
beyond section → sub-section; a separate UI-only action concept; mobile layouts.
