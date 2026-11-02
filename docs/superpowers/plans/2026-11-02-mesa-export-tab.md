# Mesa de noche: Export Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Export page match the prototype without changing how export works.

**Architecture:** UI only, inside `src/modules/export/ui`. Every field, the queue and the runner already exist, so no command, store shape or Rust code changes.

**Tech Stack:** React 19, Tailwind v4, `@/ui`.

**Spec:** `docs/superpowers/specs/2026-11-02-mesa-de-noche-design.md`. Requires the Foundation plan.

**Visual reference:** `docs/prototype/designs/b-mesa-de-noche.html#page:export`

## File Tree

`~` is an edited file and `-` is a removed file. This plan adds no new files.

```
cloudy-clip/
└─ src/modules/export/
   ├─ ~ README.md                    says the settings sections fold
   └─ ui/
      ├─ ~ ExportFacts.tsx           strip of four stats
      ├─ - ExportHeading.tsx         only if nothing uses it after Task 2
      ├─ ~ ExportPage.tsx            392px column, fold state
      ├─ ~ ExportStage.tsx
      ├─ ~ ExportWarning.tsx
      ├─ ~ KindTiles.tsx
      ├─ ~ QualitySlider.tsx
      ├─ ~ QueueItem.tsx
      ├─ ~ QueuePanel.tsx            red Export button
      ├─ ~ RangeField.tsx
      ├─ ~ SaveToSection.tsx
      ├─ ~ SettingsSection.tsx
      ├─ ~ WhatToExportSection.tsx
      └─ ~ WhenSavingSection.tsx
```

## Global Constraints

- Follow `CLAUDE.md`. Field names stay the real ones; the prototype copied them.
- Done means `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
- Commits have no Co-Authored-By line.
- No new tests: this is styling (rule 3). `mixdown.test.ts` must still pass.

## Review Focus

- A folded section must not hide a problem. If `form.blocker` is set, the warning still shows in the middle column, and Add to queue stays disabled.
- At 1100×700 the left column scrolls, and Add to queue stays reachable.
- Progress updates must not re-render the whole queue. Keep the `listOf` selector in `QueuePanel`.
- A long file name or folder path truncates and doesn't push the stats or queue out of place.
- Export must still start, cancel, and finish with the folder opening, in the real app.

---

### Task 1: Left column

**Files:**

- Modify: `src/modules/export/ui/ExportPage.tsx`, `SaveToSection.tsx`, `WhatToExportSection.tsx`, `KindTiles.tsx`, `QualitySlider.tsx`, `SettingsSection.tsx`, `WhenSavingSection.tsx`, `RangeField.tsx`
- Remove if unused: `ExportHeading.tsx` (`QueuePanel` still uses it until Task 2)

**Interfaces:**

- Consumes: `FoldSection` and `Button` variants from Foundation.

- [ ] **Step 1: Layout**

The page grid becomes `392px minmax(0,1fr) minmax(280px,21vw)`. The sections scroll and Add to queue is pinned at the bottom of the column, as the prototype's `.xfoot`.

- [ ] **Step 2: Accordions**

Wrap Save to, What to export, Kind of export, Quality, Settings and When saving in `FoldSection`. All start open and each opens or closes independently. Keep which are open in `useState` in `ExportPage`: `Record<string, boolean>`. The state lasts only as long as the page, which stays mounted.

- [ ] **Step 3: Fields**

Style tiles and rows as the prototype's Export form, with label and value columns. Keep the locked Size and Frame rate behaviour, unlocked by Custom, as `SettingsSection` already does it.

- [ ] **Step 4: Add to queue**

Use `Button variant="primary"` at full width, 34px high.

- [ ] **Step 5: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. Every field still changes the estimate in the app.

```bash
git add src/modules/export
git commit -m "feat(export): the settings column as pencil accordions"
```

### Task 2: Middle and queue

**Files:**

- Modify: `src/modules/export/ui/ExportStage.tsx`, `ExportFacts.tsx`, `ExportWarning.tsx`, `QueuePanel.tsx`, `QueueItem.tsx`, `src/modules/export/README.md`

**Interfaces:**

- Consumes: `Button variant="mark"`.

- [ ] **Step 1: Stage and stats**

The preview sits on `bg-stage`. `ExportFacts` becomes the prototype's strip of four stats, with values in `font-mono`.

- [ ] **Step 2: Queue**

Style `QueueItem` as the prototype's rows, with progress bars in `bg-on`. The main button uses `variant="mark"`, full width, 34px high, pinned at the bottom, and stays disabled when nothing is waiting. Keep the labels Export, Export all (n) and Exporting….

- [ ] **Step 3: Verify in the app**

Export a short composition with `pnpm tauri dev`.
Expected: progress moves, the file plays, and cancel works.

- [ ] **Step 4: Note it and commit**

Add one line to `src/modules/export/README.md` saying the settings sections fold. Run `pnpm typecheck && pnpm lint && pnpm test`.

```bash
git add src/modules/export
git commit -m "feat(export): stats strip and queue in the Mesa look"
```
