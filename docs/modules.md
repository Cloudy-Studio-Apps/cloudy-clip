# Modules

How a module is laid out and filled in. The rules are in [CLAUDE.md](../CLAUDE.md); this page is the
reference they point to. The module API itself is in [src/core/README.md](../src/core/README.md).

## Words

- **Module:** one folder in `src/modules/<name>/` that adds a capability (commands, MCP tools, UI,
  contributions) to a kernel. Built-ins and future plugins use the same shape.
- **Kernel:** one editor instance (`createKernel()`): its bus, history, points and loaded modules.
  Tests and a future second window each get their own, so nothing is global.
- **Ref:** a module's typed handle, `defineModuleRef<Api>("<id>")`, used with `ctx.require(ref)` and
  `useModule(ref)`.
- **Point:** a typed place where modules contribute items (`layoutPanels`, `keybindings`,
  `previewOverlays`). It lives in the module that reads it.
- **Command:** a named, typed, serializable action (`<module>.<action>`) run through the bus. The only
  way to change the project.
- **MCP tool:** what an agent calls (`<module>_<action>`), usually a thin wrapper of a command.
- **Not modules:** the kernel (`src/core`), the UI kit (`src/ui`), the shell (`src/app`), platform
  implementations, pure helpers, a module's internal parts, and interchangeable implementations of one
  contract (preview engines, decoders).

## Tiers

| Tier      | Means                                                                                          | May require           |
| --------- | ---------------------------------------------------------------------------------------------- | --------------------- |
| `core`    | The app can't exist without it. Loaded first.                                                  | core modules only     |
| `feature` | Optional. Written only against public APIs (`index.ts`), exactly as a plugin would be written. | core and feature ones |

| Module        | Tier    | Requires                                                                                 | Owns                                                                                                                       |
| ------------- | ------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `project`     | core    | —                                                                                        | the document (compositions, media, tracks, clips), placement                                                               |
| `element`     | core    | `project`                                                                                | element declarations, shared groups, prop types, `element.setProps`                                                        |
| `junction`    | core    | `project`, `element`                                                                     | junction kinds (what sits on a cut between two clips), registry                                                            |
| `fonts`       | core    | `element`                                                                                | font families (bundled, installed, Google), face loading                                                                   |
| `media`       | core    | `project`, `element`                                                                     | import, probes, proxies, library panel, the `media` element                                                                |
| `preview`     | core    | `project`, `element`, `junction`, `media`, `fonts`                                       | playback clock, engine, viewer, preview panel, overlays                                                                    |
| `timeline`    | core    | `project`, `element`, `junction`, `media`, `preview`                                     | track and clip commands, `addElement`, create tiles, timeline panel                                                        |
| `composition` | core    | `project`, `element`, `media`, `timeline`                                                | composition commands and tools, dialog, Library section, timeline tabs, the `composition` element                          |
| `inspector`   | feature | `project`, `element`, `preview`, `timeline`, `junction`, `media`, `composition`          | the right column, its tabs and sections, generated element panels, controls                                                |
| `transform`   | feature | `project`, `element`, `media`, `fonts`, `preview`, `timeline`                            | the `transform` shared group, `transform.reset`, canvas tools                                                              |
| `text`        | feature | `project`, `element`, `preview`, `timeline`, `transform`, `fonts`, `inspector`           | the `text` element, Text tab, presets, font controls, in-place editing                                                     |
| `transition`  | feature | `project`, `element`, `junction`, `timeline`, `inspector`                                | the `transition` junction kind, the `transitionPresets` point, `transition.apply`                                          |
| `sticker`     | feature | `project`, `element`, `preview`, `timeline`, `transform`, `inspector`                    | the `sticker` element, Stickers tab, `stickerPacks` and `stickerStyles`, `sticker.add`                                     |
| `collab`      | feature | `project`, `preview`, `timeline`                                                         | presence, access, the agent pointer and playhead, Follow                                                                   |
| `audio`       | feature | `project`, `inspector`, `preview`, `timeline`, `keyframe`                                | how a clip sounds: volume, pan, fades, EQ, pitch, and the Audio tab                                                        |
| `keyframe`    | feature | `project`, `element`, `preview`, `inspector`, `timeline`                                 | keys on a clip's values: `keyframe.*` commands, diamonds, the Keyframes and Curves panel, motion path                      |
| `speed`       | feature | `project`, `junction`, `media`, `timeline`, `preview`, `inspector`, `keyframe`           | how fast a clip plays: `speed.set`, the box over the clip, the Speed section, Freeze frame, Reverse, ramps                 |
| `solid`       | feature | `project`, `element`, `media`, `transform`                                               | solid colors: the element, library items with their smart bin, the dialog                                                  |
| `settings`    | feature | —                                                                                        | the Settings window and the `settingsSections` point                                                                       |
| `theme`       | feature | `settings`                                                                               | themes: the `themes` point, the user's choice, applying it, the Appearance section                                         |
| `tint`        | feature | —                                                                                        | the Tint page, for colors, empty for now                                                                                   |
| `sound`       | feature | `project`, `timeline`, `preview`, `inspector`, `audio`, `settings`, `media`, `workspace` | the Sound page and its mixer, meters and live loudness; the mix: track and master levels, effects and presets, mix A and B |
| `export`      | feature | `project`, `media`, `preview`, `workspace`                                               | the Export page and queue, turning a composition into a file                                                               |

The built-in `history` module (undo/redo) lives in `src/core/history`.

## Module anatomy

```
src/modules/<name>/
  index.ts                 REQUIRED  the public API: the ONLY file other code may import.
                                     What isn't exported here is private. TSDoc on every export.
  <name>.ref.ts            REQUIRED  export const <name>Ref = defineModuleRef<<Name>Api>("<name>")
  <name>.module.ts         REQUIRED  defineModule({ ref, name, tier, requires, commands, mcpTools,
                                     setup }). Wiring only: create stores/services, onDispose,
                                     contribute to points, return { api }. No logic.
  <name>.types.ts          REQUIRED  every type of the module, including <Name>Api (use
                                     Record<string, never> when the API is empty).
  README.md                REQUIRED  in the README template below.
  <name>.commands.ts       its commands, and the list `<name>Commands` the module registers
  <name>.<topic>.commands.ts  when there are many: one file per topic, listed by <name>.commands.ts
                              (timeline.track.commands.ts, timeline.clip.commands.ts)
  <name>.guards.ts         shared checks commands use (requireClip, overlapError, …)
  <name>.mcp.ts            its MCP tools, the list `<name>McpTools`
  <name>.store.ts          factories for its state (createXState()), never an instance
  <name>.points.ts         points this module reads (others contribute to them)
  <name>.service.ts        native access or a long-lived service, created in setup
  <name>.selectors.ts      pure reads of state
  <name>.layout.ts         UI constants (sizes, thresholds)
  <name>.testing.ts        fakes for other modules' tests (createFakeMediaModule)
  logic/                   pure functions (geometry, hit tests, snapping); one-word names
  <part>/                  an internal part with its own files (preview/engine/), <part>.types.ts
  ui/                      React only. ui/index.ts lists what module.ts contributes
    <Component>.tsx        one component per file
    <name>.hook.ts         one hook per file
    <name>.gesture.ts      imperative pointer gestures (DOM feedback, one command on release)
  *.test.ts                next to the file they test; core parts only (CLAUDE.md, rule 3)
```

| Suffix            | Holds                              | React?             |
| ----------------- | ---------------------------------- | ------------------ |
| `.module.ts`      | `defineModule`                     | imports UI, no JSX |
| `.ref.ts`         | `defineModuleRef`                  | no                 |
| `.types.ts`       | `interface` / `type` only          | no                 |
| `.commands.ts`    | `defineCommand`s                   | no                 |
| `.guards.ts`      | checks that throw `CommandFailure` | no                 |
| `.mcp.ts`         | `commandTool` / `defineMcpTool`    | no                 |
| `.store.ts`       | state factories                    | no                 |
| `.points.ts`      | `definePoint`                      | no                 |
| `.service.ts`     | native access, services            | no                 |
| `.selectors.ts`   | pure reads                         | no                 |
| `.testing.ts`     | test fakes                         | no                 |
| `logic/*.ts`      | pure functions                     | no                 |
| `ui/*.tsx`        | components                         | yes                |
| `ui/*.hook.ts`    | hooks                              | yes                |
| `ui/*.gesture.ts` | pointer gestures                   | DOM, no JSX        |

File names are dotted, never hyphenated. Split a file past ~200 lines (by topic: tracks vs clips, the
engine vs its element pool).

## Import rules

- **From another module:** only `@/modules/<name>` (its `index.ts`), and only modules that are core or
  listed in your `requires`/`uses`. ESLint rejects deep imports.
- **From the kernel:** only `@/core`. **From the UI kit:** only `@/ui`.
- **Inside your module:** relative imports (`./timeline.guards`, `../logic/placement`).
- **Never:** a core module importing a feature; any module importing `@/app`; `core` or `ui` importing
  a module.
- **Reaching state:** `ctx.require(ref)` in `setup`, commands and tools; `useModule(ref)` in React.
  During `setup`, only modules in `requires` are guaranteed loaded.

## Commands

```ts
/** What it does, for people and for the plugin API. */
export const splitAt = defineCommand({
  id: "timeline.splitAt", // <module>.<action>
  label: "Split", // shown in undo history
  description: "…", // written for agents: units, defaults, what it returns, when it fails
  undoable: true,
  input: z.object({ at: time, clipIds: z.array(z.string()).optional() }),
  run(ctx, input) {
    const store = ctx.require(projectRef).store;
    // validate everything first, throw CommandFailure("timeline.<reason>", message)
    ctx.mutate(store, (draft) => {
      /* … */
    });
    return result; // serializable
  },
});
```

- Undoable commands change only patchable stores, through `ctx.mutate`. Non-undoable ones (seek,
  play) never touch the project.
- A command that needs another command runs it with `ctx.execute(other, input)`.
- Test commands against a real kernel (`createKernel()` + `loadAll([...])`, fakes from `.testing.ts`).

## MCP files

```ts
/** One line on what agents can do with these. */
export const timelineMcpTools = [
  commandTool(splitAt, { name: "timeline_split" }),
  // read-only tools: defineMcpTool({ name, description, input, handler }) returning textResult(…)
];
```

Tool names start with the module id. A tool never holds logic a command doesn't: if an agent needs
it, so does the UI, and it becomes a command.

## Contributing to the UI

| Point               | Owner        | Item                                                                                   |
| ------------------- | ------------ | -------------------------------------------------------------------------------------- |
| `layoutPanels`      | core (shell) | `{ id, title, slot: "side"\|"main"\|"inspector"\|"bottom", icon?, order?, component }` |
| `appPages`          | core (shell) | `{ id, label, icon, group?, order?, component? }`, a page with a tab in the top bar    |
| `appPageGroups`     | core (shell) | `{ id, order? }`, tabs that belong together; a divider separates groups                |
| `appMenuItems`      | core (shell) | `{ id, menu?, label, order?, keybinding?, run?, enabled?, items? }`, the logo's menu   |
| `keybindings`       | core (shell) | `{ id, key, mod?, shift?, resolve() → { command, input } \| null }`                    |
| `libraryKinds`      | `media`      | `{ type, label, icon, useEntries, Tile, CreateButton? }`, items besides files          |
| `previewOverlays`   | `preview`    | `{ id, component }`, drawn over the frame, in % of it                                  |
| `elements`          | `element`    | an `ElementDefinition` (`defineElement`), keyed by `kind`                              |
| `sharedGroups`      | `element`    | a `SharedGroup` (`defineSharedGroup`), keyed by `id`                                   |
| `propTypes`         | `element`    | a `PropType` (`definePropType`), keyed by `name`                                       |
| `propertyControls`  | `inspector`  | `{ id, for: "field" \| "command", component }`                                         |
| `sectionLayouts`    | `inspector`  | `{ id, component }`, draws a whole panel section                                       |
| `inspectorTabs`     | `inspector`  | `{ id, label, icon, order, contextual? }`, available when a section lands in it        |
| `inspectorSections` | `inspector`  | `{ id, tab, title, order, appliesTo?, bare?, component }`, add to any clip's panel     |
| `fieldActions`      | `inspector`  | `{ id, order, appliesTo?, component }`, the end of a field's row                       |
| `timelineTools`     | `timeline`   | `{ id, order, component }`, a control at the left of the toolbar                       |
| `clipActions`       | `timeline`   | `{ id, doubleClick?, items?, badge? }`, a clip's double click, menu entries and badge  |
| `timelineDocks`     | `timeline`   | `{ id, order?, component }`, a panel docked under the tracks                           |
| `keyTargets`        | `keyframe`   | `{ id, fields(clip, track), afterWrite? }`, the values of a clip that can be keyed     |

`side` panels become tabs of the left rail (`title` + `icon`). Keybindings always resolve to a
command, so shortcuts, buttons and agents share one path.

## Declaring an element

Every kind of clip is an element. Declare it once and contribute it; validation, defaults, the
inspector panel, drawing, hit-testing, creation and the MCP description all come from it. See
`src/modules/element/README.md` and `src/modules/text/text.element.ts`.

```ts
export const stickerElement = defineElement({
  kind: "sticker",
  name: "Sticker",
  source: "none", // no file: any length, sourceIn stays 0
  tracks: ["video"],
  supports: { transform: { except: ["rotation"] } }, // shared groups, opt-in
  properties: {
    tint: prop.color({ opacity: "opacity" }),
    opacity: prop.number({ min: 0, max: 1, control: "slider", display: { scale: 100, unit: "%" } }),
    border: prop.group(
      { label: "Border", toggle: "on" },
      { on: prop.boolean(), width: prop.number({ min: 0, max: 50 }) },
    ),
    "transform.scale": { kind: "number", ui: { max: 4 } }, // narrow a shared field
  },
  defaults: () => ({ tint: "#ffffff", opacity: 1, border: { on: false, width: 4 } }),
  layout: [
    { title: "Look", items: ["tint", { command: "sticker.shuffle", label: "Shuffle" }] },
    { items: ["border"] },
  ], // optional
  display: (clip) => ({ icon: Sticker, color: "clip-type", label: "Sticker", body: "none" }),
  picture: { fit: "none", size: () => ({ width: 200, height: 200 }), draw: drawSticker },
  create: [{ panel: "stickers", id: "star", label: "Star" }],
});
// in setup: ctx.contribute(elements, stickerElement)
```

- Values live in `clip.props`, only what differs from `defaults(format)`; change them with
  `element.setProps` (MCP `element_set_props`). Shared group values live under their key.
- Without `layout`: a "General" section for top-level fields, one section per group (its toggle
  in the header), then each shared group's own section.
- A command placed in a layout is named by id and takes `clipIds` plus at most one field; augment
  `CommandInputs` in your `<name>.types.ts` so the id type-checks:
  `declare module "@/core" { interface CommandInputs { "sticker.shuffle": { clipIds: string[] } } }`.
- Missing commands, controls, section layouts or prop types show a warning row and are logged once;
  the rest of the panel works.

## README template

Every module's `README.md` follows this shape. Update it in the same change as the code.

```md
# <name>

<One paragraph: what the module is, as the user sees it.>

- **Tier:** core | feature
- **Requires:** `a`, `b` (and `uses` / `after` when it has them)
- **Contributes:** panel `x.panel` (slot); keybindings `x.y` (Key); overlay `x.overlay`
- **Points it owns:** `xPoint` (who contributes to it)
- **API** (`useModule(xRef)` / `ctx.require(xRef)`): `field`, `method()`
- **Files:** the important ones and what they hold
- **Not yet:** what is deliberately missing

| Command | MCP tool | Notes |
| ------- | -------- | ----- |
| `x.do`  | `x_do`   | …     |
```

## New module checklist

1. Create `src/modules/<name>/` with `index.ts`, `<name>.ref.ts`, `<name>.module.ts`,
   `<name>.types.ts` and `README.md`.
2. Pick the tier. A feature touches only public APIs; anything private it needs gets exported from
   the owner's `index.ts` first.
3. List every module you use in `requires` (or `uses`), and nothing else.
4. Put commands in `<name>.commands.ts` and tools in `<name>.mcp.ts`; register both in
   `defineModule`. TSDoc on each.
5. State goes in factories in `<name>.store.ts`, created in `setup`; cleanups go to `ctx.onDispose`.
6. UI goes in `ui/`, one component per file, built from `@/ui`; contribute it through a point.
7. Pure logic goes in `logic/`. A new kind of clip is an element (see "Declaring an
   element"); its commands that act on clips take `clipIds` and augment `CommandInputs`.
8. Add the module to `MODULES` in `src/app/bootstrap.ts`.
9. Write the README in the template, and add the module to the tier table above.
10. `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
