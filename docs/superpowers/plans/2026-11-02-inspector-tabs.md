# Inspector tabs Implementation Plan

> **For agentic workers:** executed inline with superpowers:executing-plans, on the current branch.
> Commits carry no Co-Authored-By line.

**Goal:** the Resolve-style side panel from `docs/prototype/` in the app, with tabs, sections and row
actions any module or plugin can add to.

**Architecture:** three new inspector points (`inspectorTabs`, `inspectorSections`, `fieldActions`),
a `tab` on layout sections, `FieldRow` as the whole row, one reset route, view state in a per-kernel
store.

**Tech Stack:** React 19, Zustand, Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-02-inspector-tabs-design.md`

## Global Constraints

- A change is done when `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
- No new tests unless a bug calls for it (rule 3 and the prune-tests preference).
- Types in `.types.ts`, TSDoc on public exports, no `clip.kind` branches, semantic tokens only.
- `FieldControlProps` does not change. `SliderField`'s and `ToggleRow`'s default look does not change.

## Review Focus

- A section naming a tab that isn't registered: warned once, still reachable, nothing lost.
- A remembered tab that doesn't apply to the next clip: falls back to the first available tab.
- A clip deleted or undone away while its tab is open: the panel shows nothing, no crash.
- Reset of a color with an opacity sibling, or of a section with a toggle: one undo step, toggle kept.
- A narrow inspector (280px): tab labels and rows stay readable.

---

### Task 1: Contracts

**Files:** `element.types.ts`, `element/logic/layout.ts`, `element.registry.ts`,
`inspector.points.ts`, `inspector.types.ts`, `inspector.view.store.ts` (new),
`inspector.module.ts`, `inspector/logic/tabs.ts` (new), `inspector/index.ts`, `timeline/index.ts`.

**Produces:**

- `LayoutSection.tab?: string`, `ResolvedSection.tab?: string`; row item `label?` in `LayoutItem` and
  `ResolvedItem`.
- `ElementApi.defaults(kind: string, format: ProjectFormat): Record<string, unknown>`.
- Points `inspectorTabs`, `inspectorSections`, `fieldActions`; types `InspectorTab`,
  `InspectorSectionItem`, `InspectorContext`, `FieldAction`, `FieldActionProps`.
- `InspectorApi.view`: store of `{ tabs: Record<string, string>; folded: string[] }` with
  `setTab(kind, id)`, `setFolded(key, folded)`.
- `tabState(tabs, used: ReadonlySet<string>)`, `sectionTab(section, tabs)`, `pickTab(...)` in `logic/tabs.ts`.

Commit: `feat(inspector): tabs, sections and field actions as points`

### Task 2: Rows

**Files:** `controls/FieldRow.tsx`, `controls/field.context.ts` (new), every built-in control,
`FieldItem.tsx`, `FieldActions.tsx` (new), `ResetAction.tsx` (new), `PropertyPanel.tsx`,
`src/ui/kit/NumberField.tsx`, `src/ui/kit/SliderField.tsx`, text and sticker controls that draw their
own label.

**Produces:** `useFieldRow()`; `FieldRow` with label column and end column; `NumberField` `prefix`,
`onInput`; `SliderField` `bare`; `resetPatch(paths, defaults, fields, values)` in `logic/reset.ts`.

Commit: `feat(inspector): rows with a label column and field actions`

### Task 3: Bands

**Files:** `InspectorSection.tsx`, `PanelSection.tsx`, `SubSection.tsx`, `VariationSection.tsx`.

**Produces:** `InspectorSection` props `foldKey`, `leading`, `actions`; header reset.

Commit: `feat(inspector): section bands with switch, title and reset`

### Task 4: Tabs

**Files:** `InspectorTabs.tsx` (new), `TabBody.tsx` (new), `clip.tabs.hook.ts` (new), `ClipView.tsx`,
`ElementPanel.tsx`, `PropertyPanel.tsx`, `TimingSection.tsx` and `InfoSection.tsx` (new).

**Produces:** the strip, merged sections, linked partners, Timing and Info contributed to `file`.

Commit: `feat(inspector): tabs for a selected clip`

### Task 5: Contributions

**Files:** `transform.group.ts`, `text.module.ts`, `text.panel.ts`, `sticker.module.ts`,
`sticker.element.ts`, `SoundSection.tsx` (new), `JunctionBody.tsx` (new), `JunctionsSection.tsx`
(new), `JunctionView.tsx`.

Commit: `feat(inspector): Video, Audio, Transition and contextual tabs filled`

### Task 6: Finish

**Files:** `LayoutHost.tsx`, `layout.sizes.ts`, READMEs of `inspector`, `element`, `transform`,
`text`, `sticker`, `docs/modules.md`, `CLAUDE.md` rule 13.

Verify in the running app clip by clip, dark and light; then `pnpm typecheck && pnpm lint && pnpm test`.

Commit: `docs(inspector): tabs in the module docs`
