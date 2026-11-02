# Inspector tabs: design

**Status:** approved 2026-11-02.

**Goal:** bring the Resolve-style side panel the user approved in `docs/prototype/` into the app,
and make tabs, sections and row actions something any module, and later any plugin, can add to.

## What exists now

The inspector is already well built for plugins, and most of it stays.

| Part                                                                       | State                                                      |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Elements declare properties and layout; `resolveLayout` makes the sections | Keep. Only tab placement is missing                        |
| `propertyControls`, `sectionLayouts`, `propTypes`                          | Keep. Plugins can already add controls and section layouts |
| `PropertyPanel` and `PropsLive`                                            | Keep. The same code edits clips and junctions              |
| Missing pieces show a `WarningRow`                                         | Keep, and extend to tabs                                   |

Five things block the new design:

1. **No idea of a tab.** A clip's panel is one long list, and `LayoutSection` can't say where a
   section belongs.
2. **`ClipView` hard-codes Timing and Info.** A plugin can only add sections by owning the element
   or a shared group. It can't add a section to someone else's clip.
3. **Controls draw their own label.** `SliderField` and `ToggleRow` have their own, others use
   `FieldRow`. So rows can't line up, and no row can gain a reset without editing each control.
4. **Fold state is `useState` in each section.** It would be lost on every tab or clip change.
5. **Reset exists only for transform, as a button.** `element.resetProps` covers clips, but
   `junction.set` has no reset.

Scoped out by what the app can do today: `Soon` sections in the mock are not built (see Decisions).

## The design

A panel is **tabs** (a strip), each holding **sections** (bands), each holding **rows**. Each level
gets one extension mechanism, and built-ins use the same ones.

### Tabs: a new point, `inspectorTabs`

```ts
interface InspectorTab {
  id: string;
  label: string;
  icon: LucideIcon;
  order: number;
  /** Hidden when empty (Text, Sticker) instead of greyed out (Video, Audio). */
  contextual?: boolean;
}
```

A tab holds no logic about when it applies. **A tab is available exactly when a section lands in
it.** Otherwise it is greyed, or hidden when `contextual`. So nobody writes `if kind === …`, and rule
23 stays intact.

Contributed by: `inspector` (Video 100, Audio 200, Transition 300, File 400), `text` (Text 10,
contextual), `sticker` (Sticker 10, contextual). A plugin element adds a tab the same way.

### Sections: two sources, one list

**From elements and shared groups.** `LayoutSection` gains `tab?: string`, carried through to
`ResolvedSection`. `element` treats it as an opaque string, as it does `layout`. No `tab` means
`"video"`. An unknown tab id logs a warning and the section lands in the first tab, so no property
is ever lost.

**From anywhere, a new point `inspectorSections`,** for things that are not properties of an
element:

```ts
interface InspectorSectionItem {
  id: string;
  tab: string;
  title: string;
  order: number;
  appliesTo?(context: InspectorContext): boolean;
  component: ComponentType<{ context: InspectorContext }>;
}
/** The clip shown, its track, and its linked partner when it has one. */
interface InspectorContext {
  clip: Clip;
  track: Track;
  partner?: { clip: Clip; track: Track };
}
```

The inspector wraps each in the standard band, so a plugin can't look out of place. Timing and Info
become contributions to File, by the same route a plugin would use. `ClipView` loses its hard-coded
sections.

Both sources merge, sorted by `order`, inside `TabBody`.

**Linked clips.** The sections of the clip and of its partner are both collected, each edited
through its own `usePropsLive`. Clicking the sound of a linked video still offers Transform in the
Video tab, and the picture still offers the sound's sections in Audio. This matches the rule that a
linked picture and sound count as one clip.

### Rows: `FieldRow` becomes the row

`FieldRow` draws the right-aligned label column and the control. `FieldItem`, not the control, draws
the end column, **so `FieldControlProps` doesn't change** and every custom control gets it for free,
one per field even when the control draws several rows, like `VariationControl`.

Every built-in control moves to `FieldRow`. `SliderField` and `ToggleRow` stay in the kit as they
are for Export and dialogs, with a way to leave out the label.

**A new point, `fieldActions`,** fills the end column:

```ts
interface FieldAction {
  id: string;
  order: number;
  component: ComponentType<FieldActionProps>;
}
```

Reset is its first contribution. Keyframes, when they come, are a second one, and no control has to
change. The column has a fixed width, so values stay aligned.

**Labelled rows.** The `row` layout item gains `label?`, so Transform writes
`{ row: ["x", "y"], label: "Position" }`. Inside such a row each `FieldRow` drops its own label, and
`NumberField` shows it as a prefix ("X", "Y"). That prefix can be dragged to scrub, as in the mock:
live through `live.input`, written to the DOM (rule 24), one command on release (rule 15).

### Reset

`PropsLive` gains an optional `reset(paths)`, one undo step, for a row or a whole section. Clips run
`element.resetProps`. Merging defaults over stored values would not do: a merge can't remove keys of
an object value, like a sticker's variation. `junction.set` has the same limit and no reset command,
so junctions have no `reset` and show none.

A section header's on/off value is left out of a section reset, as are the user's words, and
read-only or disabled fields are skipped.

`ElementApi` gains `defaults(kind, format)`, including shared groups, to tell what changed.

The `transform.reset` button leaves Transform's layout, since the header reset replaces it. The
command and `transform_reset` stay for agents.

### Section band

`InspectorSection` becomes the band: switch slot on the left (empty when there is no toggle), title
that folds it, right-hand actions. It stays exported, so `VariationSection` keeps working. `PanelSection`
fills the slots. A section switched off hides its body, as it does today. The chevron goes, as in
the mock.

### View state: a per-kernel store

`inspector.view.store.ts` (rule 12) holds `tab` per element kind and the set of folded section keys
(`<kind>:<section.key>`). Ephemeral and never in history (rule 16). Exposed on `InspectorApi`.

No commands or MCP tools: agents don't have tabs. They already read and change everything through
`project_get_state` and `element_set_props`, so rule 19 still holds.

**Collab:** `inspector:transform` may be on a hidden tab. `locate.ts` already falls back to the
inspector panel when a target has no box, so the agent's pointer lands on the panel. No change.

### Transition tab

`JunctionView` splits into its header and a `JunctionBody`. A section contributed by the inspector
lists the clip's junctions (`junctionsOfClip`, for the clip and its partner, deduplicated), titled
by side ("In", "Out"), each with `JunctionBody`. Selecting a junction on the timeline still shows
`JunctionView`, without a tab strip.

### Tab content per clip

| Clip          | Tabs                                                       |
| ------------- | ---------------------------------------------------------- |
| Video + sound | Video · Audio · Transition (when it has one) · File        |
| Image         | Video · Audio greyed · Transition (when it has one) · File |
| Sound only    | Video greyed · Audio · Transition (when it has one) · File |
| Composition   | Video · Audio (when it has sound) · Transition · File      |
| Text          | **Text** · Video · Audio greyed · Transition · File        |
| Sticker       | **Sticker** · Video · Audio greyed · Transition · File     |

- **Video:** Transform.
- **Audio:** Sound, a contributed section: track name, Mute track (`timeline.setTrackMuted`), what
  it's linked to.
- **File:** Timing, Info.

The image tab keeps the "Video" label: a tab's label is fixed by the point, and an element-specific
label isn't worth an API for one word.

## How a plugin uses this

A plugin that adds a Shape element and a Stabilization section:

```ts
contribute(inspectorTabs, {
  id: "shape",
  label: "Shape",
  icon: Hexagon,
  order: 10,
  contextual: true,
});
contribute(
  elements,
  defineElement({ /* … */ layout: [{ title: "Geometry", tab: "shape", items: ["sides"] }] }),
);
contribute(inspectorSections, {
  id: "stabilize.section",
  tab: "video",
  title: "Stabilization",
  order: 950,
  appliesTo: ({ clip }) => clip.mediaId !== undefined,
  component: StabilizePanel,
});
```

Nothing in `inspector` changes for either.

## Stages

Each stage leaves the app working and passes `pnpm typecheck`, `lint` and `test`.

1. **Contracts.** `tab` and row `label` in `element`; `ElementApi.defaults`; the three points and
   types; the view store; `logic/tabs.ts` (grouping, availability, fallback). Export `withPartners`
   from `timeline`, which rule 8 requires instead of reaching in.
2. **Rows.** New `FieldRow` and its context, controls moved over, `fieldActions` with reset, kit
   additions (`NumberField` prefix and scrub, label-less `SliderField`).
3. **Bands.** `InspectorSection`, `PanelSection`, the header reset, fold state in the store.
4. **Tabs.** The strip, `TabBody`, a rewritten `ClipView`, Timing and Info as contributions.
5. **Contributions.** Transform layout; Text and Sticker tabs; Sound section; Transition tab.
6. **Finish.** Default width, READMEs (`inspector`, `element`, `transform`, `text`, `sticker`),
   `docs/modules.md`, rule 13 in `CLAUDE.md`, checks in the running app.

## Tests

Following rule 3, this adds almost none: the inspector is not the kernel or document integrity.
`logic/tabs.ts` gets none unless a bug calls for it. The check is the running app, clip by clip, in dark and light.

## Risks

- **Uncommitted work overlaps.** Pages and the Sound page are in progress in the same tree, touching
  `LayoutHost.tsx` (where the default width lives), `shell.*`, `SegmentedControl` and `kit.types.ts`.
  This should land first, or the width change should wait. `SegmentedControl` is used by the
  inspector's choice controls.
- **`SliderField` is shared with Export.** Label-less must be opt-in.
- **Section `live` objects.** `usePropsLive` runs per section rather than per panel. A drag touches
  one section, so pending patches can't collide, but this needs checking with a color and its
  opacity, which commit one patch.
- **Width.** The app's inspector can shrink to 240px, too narrow for the tabs with labels. Raise the
  minimum to 280 and the default to 360, as in the mock.

## Decisions

Made here; say if any is wrong.

- **Nothing fake ships.** No `Soon` sections and no placeholders in the app: Composite, Animation,
  Speed, Color and Volume wait until they exist. So the Video tab holds only Transform for now.
- **No keyframe diamonds** until keyframes exist. `fieldActions` is where they will go.
- **No Effects tab** until effects exist (the user's call). Adding it later is one contribution.
- **No Transform switch** for now (the user's call). It needs an `enabled` value that `clipPlacement`
  and the canvas tools honor, so it is its own feature.
- **Tabs are for clips only.** The project and multi-clip views keep their current content, in the
  new band style.
