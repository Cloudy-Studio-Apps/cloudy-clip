# Mesa de noche: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the whole app the Mesa de noche look: tokens, fonts, kit, seal and shell. Every tab plan builds on this.

**Architecture:** Token names stay and their values change, so most components follow without edits. Kit components change in `src/ui`, and shell changes stay in `src/app`. No document or engine change.

**Tech Stack:** Tailwind v4, Fontsource, React 19, Zustand.

**Spec:** `docs/superpowers/specs/2026-11-02-mesa-de-noche-design.md`

## File Tree

`+` is a new file and `~` is an edited file.

```
cloudy-clip/
├─ ~ CLAUDE.md                        rules 35 and 36
├─ ~ package.json                     three new font packages
├─ ~ pnpm-lock.yaml
├─ docs/prototype/
│  ├─ ~ README.md
│  └─ + designs/                      first commit of the prototype, the visual reference
└─ src/
   ├─ ~ index.css                     fonts, type sizes, new token mappings
   ├─ app/
   │  ├─ layout/
   │  │  ├─ ~ LayoutHost.tsx          default sizes, 48px top row
   │  │  ├─ ~ SideRail.tsx            78px rail
   │  │  └─ ~ layout.sizes.ts         TOP_BAR_HEIGHT
   │  └─ top-bar/
   │     ├─ ~ Brand.tsx               wordmark
   │     ├─ ~ HistoryControls.tsx
   │     ├─ ~ PageTabs.tsx            index tabs
   │     └─ ~ TopBar.tsx
   ├─ modules/
   │  ├─ collab/ui/
   │  │  └─ ~ CollabAvatars.tsx       styling only
   │  ├─ inspector/ui/
   │  │  └─ ~ InspectorSection.tsx    wraps FoldSection
   │  ├─ media/
   │  │  ├─ ~ README.md
   │  │  ├─ ~ index.ts                exports MEDIA_PAGE
   │  │  └─ ~ media.module.ts
   │  └─ workspace/
   │     ├─ ~ README.md
   │     ├─ ~ workspace.session.ts    which page a project opens on
   │     └─ ui/
   │        └─ ~ ProjectTitle.tsx     styling only
   └─ ui/
      ├─ ~ README.md
      ├─ ~ index.ts
      ├─ brand/
      │  └─ ~ SealMark.tsx            the foca watona
      ├─ kit/
      │  ├─ ~ Button.tsx              primary, secondary, mark
      │  ├─ ~ Dialog.tsx
      │  ├─ ~ EmptyState.tsx          uses the rough seal
      │  ├─ + FoldSection.tsx         the accordion band
      │  ├─ ~ IconButton.tsx
      │  ├─ ~ NumberField.tsx
      │  ├─ ~ SegmentedControl.tsx
      │  ├─ ~ SelectField.tsx
      │  ├─ ~ SliderField.tsx
      │  ├─ ~ Switch.tsx
      │  ├─ ~ Toolbar.tsx
      │  └─ ~ kit.types.ts
      └─ styles/
         ├─ ~ base.css                scrollbars
         └─ ~ tokens.css              Mesa de noche colours
```

## Global Constraints

- Follow `CLAUDE.md`: semantic tokens only, `lucide-react` icons, no module-level singletons, files around 200 lines, dotted file names.
- Done means `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
- Commits have no Co-Authored-By line. Work on the current branch.
- UI styling gets no tests (rule 3). Check it by running the app next to the prototype.
- Fonts load from the app bundle and never from the network.

## Review Focus

- WebKitGTK is the real target: fonts, scrollbars and the page-tab shadow must be checked in `pnpm tauri dev`, not only in Chromium.
- Text on `bg-primary` used to be white and is now dark. Every `text-primary-foreground` must stay readable, including badges and `primary-soft`.
- A window at 1100×700 must not clip the top bar, and a long project name must truncate before it touches the tabs.
- Panel sizes saved by earlier sessions still apply. A saved side width below the new rail plus content must clamp, not overflow.
- Text clips that use Inter or JetBrains Mono must look the same in preview and export after the UI fonts change.

---

### Task 1: Tokens and fonts

**Files:**

- Modify: `package.json`, `src/index.css`, `src/ui/styles/tokens.css`, `src/ui/styles/base.css`, `src/ui/README.md`, `CLAUDE.md` (rule 35), `docs/prototype/README.md`
- Add to git: `docs/prototype/designs/` (these plans refer to it)

**Interfaces:**

- Produces: Tailwind tokens `bg-mark`, `text-mark`, `hover:bg-mark-hover`, `text-mark-foreground`, `bg-on`; text sizes `text-md`, `text-display`; `font-hand` (Shantell Sans), `font-sans` (Atkinson Hyperlegible), `font-mono` (Courier Prime).

- [ ] **Step 1: Install the fonts**

Run: `pnpm add @fontsource-variable/shantell-sans @fontsource/atkinson-hyperlegible @fontsource/courier-prime`
Expected: three new entries in `package.json`. Keep the Inter and JetBrains Mono packages.

- [ ] **Step 2: Import them in `src/index.css`**

Import the 400 and 700 weights of Atkinson Hyperlegible and Courier Prime, plus the Shantell variable font. Set `--font-sans`, `--font-mono` and a new `--font-hand`. Add `--text-md: 14px` with line height 18px, and `--text-display: 19px` with line height 24px. Inter and JetBrains Mono keep their `@import`, as text clips draw with them.

- [ ] **Step 3: Set the tokens**

Apply the spec's token table to the `:root, :root[data-theme="dark"]` block of `tokens.css`. Map `--color-mark`, `--color-mark-hover`, `--color-mark-foreground` and `--color-on` in `@theme inline`. Leave Cloudy Light alone.

- [ ] **Step 4: Scrollbars**

In `base.css`, copy the prototype's thin pencil scrollbars (lines 34–39 of `b-mesa-de-noche.html`), using `--border-strong`. Keep `data-scroll="wide"` working for the timeline.

- [ ] **Step 5: Update the rules**

Rewrite the fonts sentence of `CLAUDE.md` rule 35, and the matching lines of `src/ui/README.md`:
"Type scale is `text-2xs`…`text-md` (10–14px), plus `text-display` for the wordmark. UI fonts are Shantell Sans (`font-hand`, for titles, tabs and buttons), Atkinson Hyperlegible and Courier Prime (Fontsource, offline). Inter and JetBrains Mono stay bundled for text clips. The look follows `docs/prototype/designs/b-mesa-de-noche.html`."
Add that round shapes are also allowed for switch thumbs and EQ points. In `docs/prototype/README.md`, replace "Only the tabs work" with a note that `b-mesa-de-noche.html` is the chosen direction.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. Then run `pnpm tauri dev` with the network off: all three UI fonts show, and an Inter text clip looks unchanged.

- [ ] **Step 7: Commit**

```bash
git add -A package.json pnpm-lock.yaml src CLAUDE.md docs/prototype
git commit -m "feat(ui): Mesa de noche tokens and fonts"
```

### Task 2: Kit components

**Files:**

- Modify: `src/ui/kit/Button.tsx`, `Switch.tsx`, `IconButton.tsx`, `Toolbar.tsx`, `SliderField.tsx`, `NumberField.tsx`, `SelectField.tsx`, `SegmentedControl.tsx`, `Dialog.tsx`, `kit.types.ts`
- Create: `src/ui/kit/FoldSection.tsx`
- Modify: `src/ui/index.ts`, `src/ui/README.md`, `src/modules/inspector/ui/InspectorSection.tsx`

**Interfaces:**

- Produces: `Button` variants `primary` (white pencil: `--foreground` on `--surface`), `secondary` (outlined, the prototype's `.btn-ghost`) and new `mark` (red, for starting an export). `FoldSection` is below.

```ts
interface FoldSectionProps {
  title: string;
  open: boolean;
  onToggle(): void;
  /** Left of the title: a group's switch. The slot stays, so titles line up. */
  leading?: ReactNode;
  /** Right of the band; clicking them doesn't fold. */
  actions?: ReactNode;
  children?: ReactNode;
}
```

- [ ] **Step 1: Restyle the controls**

Match the prototype's `.btn`, `.btn-ghost`, `.btn-primary`, `.icon`, `input.switch` and `.search`. Buttons use `font-hand` with 3px corners and heights of 30px, or 28px at `sm`. Switches are 30×16 with a 12px round thumb and use `bg-on` when checked. Focus stays a 2px `--ring` outline.

- [ ] **Step 2: Add `FoldSection`**

It's a stateless band with a chevron that turns when open, a `font-hand` title, and the `leading` and `actions` slots. It has `aria-expanded` and matches the prototype's `.sect h4`. Move the markup out of `InspectorSection.tsx`, which keeps only its fold store and passes `open` and `onToggle`.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. In the app, inspector sections fold and remember their state as before, and a switch in a band doesn't fold it.

- [ ] **Step 4: Commit**

```bash
git add src/ui src/modules/inspector/ui/InspectorSection.tsx
git commit -m "feat(ui): pencil-styled kit and FoldSection"
```

### Task 3: The seal

**Files:**

- Modify: `src/ui/brand/SealMark.tsx`, `src/ui/kit/EmptyState.tsx`, `src/ui/README.md`, `CLAUDE.md` (rule 36)

**Interfaces:**

- Produces: `SealMark({ className?: string; rough?: boolean })`. `rough` adds the blue construction lines. Default false.

- [ ] **Step 1: Redraw**

Replace the paths with those of the prototype's `<symbol id="seal">` (viewBox `0 0 120 100`). Colours keep their hex values, as this is brand art. The construction-lines `<g>` renders only with `rough`. Remove the `useId` gradient. Check `size-6` callers now that the art is wider than it is tall.

- [ ] **Step 2: Turn on `rough` where it's large**

Use it in `EmptyState` only.

- [ ] **Step 3: Update rule 36**

Add: "`SealMark` is the foca watona: spotted, with dark deadpan open eyes." Add the `rough` prop to the `src/ui/README.md` table.

- [ ] **Step 4: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. The seal reads clearly at 24px in the top bar.

```bash
git add src/ui CLAUDE.md
git commit -m "feat(ui): the foca watona replaces the old seal mark"
```

### Task 4: Shell and opening page

**Files:**

- Modify: `src/app/layout/LayoutHost.tsx`, `src/app/layout/layout.sizes.ts`, `src/app/layout/SideRail.tsx`, `src/app/top-bar/TopBar.tsx`, `src/app/top-bar/Brand.tsx`, `src/app/top-bar/PageTabs.tsx`, `src/app/top-bar/HistoryControls.tsx`
- Modify: `src/modules/media/index.ts`, `src/modules/media/media.module.ts`, `src/modules/media/README.md`, `src/modules/workspace/workspace.session.ts`, `src/modules/workspace/README.md`
- Modify: `src/modules/workspace/ui/ProjectTitle.tsx`, `src/modules/collab/ui/CollabAvatars.tsx` (styling only)

**Interfaces:**

- Produces: `MEDIA_PAGE = "media.page"`, exported from `@/modules/media`, with TSDoc.
- Produces: `TOP_BAR_HEIGHT = 48`.

- [ ] **Step 1: Index tabs**

`PageTabs` stops using `SegmentedControl` and renders the prototype's `.pg` tabs inside a `role="tablist"`. A tab is the edge of the sheet below it, so the active one is taller, uses `bg-surface`, and has a 2px `--mark` line on top. Group dividers stay. The top bar becomes `bg-surface-sunken` and aligns the tabs to its bottom edge.

- [ ] **Step 2: Brand**

Show the wordmark as lowercase "cloudy clip" in `font-hand` at `text-display`, weight 800. The project title uses `font-mono`.

- [ ] **Step 3: Rail**

`SideRail` is 78px wide on `bg-muted`, with 56px tabs and icons above labels. The active tab joins its sheet (`bg-surface`, 2px inset `--mark` line on the left).

- [ ] **Step 4: Sizes**

Change the grid defaults in `LayoutHost` to `--side-w` 350px and `--timeline-h` 300px, keep `--inspector-w` at 360px, and set the first row to 48px. Remove the 1px `gap-px` divider only if the prototype's flush sheets need it. Otherwise keep it, as dragging depends on those edges.

- [ ] **Step 5: Opening page**

In `workspace.session.ts`, after a project becomes the document (new, open, recent), run `showPage` with `MEDIA_PAGE` when `Object.keys(document.clips).length === 0`, otherwise `EDITOR_PAGE`. Add this to the workspace README. An agent's `workspace_open` also changes the page the user sees, so skip the switch unless the local actor asked for it.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. In the app, a new project opens on Media, a project with clips opens on Edit, the tab order is Media, Edit, Sound, Export, and hidden pages keep their state.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat(app): index tabs, side rail and the page a project opens on"
```
