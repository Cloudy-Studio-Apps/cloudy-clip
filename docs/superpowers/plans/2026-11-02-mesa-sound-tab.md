# Mesa de noche: Sound Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The empty Sound page shows the seal drawing itself and says the page isn't ready yet.

**Architecture:** One kit component plus a page change. The page stays empty. Clip sound controls are in the inspector's Audio tab (its own plan).

**Tech Stack:** React 19, CSS animation, `@/ui`.

**Spec:** `docs/superpowers/specs/2026-11-02-mesa-de-noche-design.md`. Requires the Foundation plan.

**Visual reference:** `docs/prototype/designs/b-mesa-de-noche.html#page:sound`

## File Tree

`+` is a new file and `~` is an edited file.

```
cloudy-clip/
└─ src/
   ├─ ~ index.css                  draw and appear keyframes
   ├─ modules/sound/
   │  ├─ ~ README.md
   │  ├─ ~ sound.module.ts         uses SOUND_PAGE
   │  ├─ ~ sound.ref.ts            holds SOUND_PAGE
   │  └─ ui/
   │     └─ ~ SoundPage.tsx        "Sound isn't inked yet"
   └─ ui/
      ├─ ~ README.md
      ├─ ~ index.ts
      └─ brand/
         └─ + SealSketch.tsx       the seal drawing itself
```

## Global Constraints

- Follow `CLAUDE.md`, including rule 36: the seal appears in light touches only.
- Done means `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
- Commits have no Co-Authored-By line.
- No tests (rule 3).

## Review Focus

- `prefers-reduced-motion`: the finished drawing shows at once, with no animation.
- The page stays mounted behind others, so the drawing must start when the page is shown, not only at app start. It should play again each time you open the tab.
- The drawing must fit a short window without scrolling.

---

### Task 1: Self-drawing seal and page

**Files:**

- Create: `src/ui/brand/SealSketch.tsx`
- Modify: `src/index.css`, `src/ui/index.ts`, `src/ui/README.md`, `src/modules/sound/sound.ref.ts`, `src/modules/sound/sound.module.ts`, `src/modules/sound/ui/SoundPage.tsx`, `src/modules/sound/README.md`

**Interfaces:**

- Produces: `SealSketch({ className?: string })`: the seal's strokes drawn in order, then its fills.

- [ ] **Step 1: Add `SealSketch`**

Port the sound-page SVG and its `draw`, `appear` and `appear-soft` keyframes from the prototype (around lines 420–431). Put the keyframes in the `@theme` block of `index.css`. Use `pathLength="1"` so dash lengths don't need measuring. Wrap the animation in `motion-safe:`.

- [ ] **Step 2: Rewrite the page**

`SoundPage` centres `SealSketch` over the title "Sound isn't inked yet" in `font-hand`, then one line in `text-muted-foreground`: "Sound clips are on the timeline, on the Edit page." It reads whether it's active with `useStore(useModule(pagesRef).store, (s) => s.active === SOUND_PAGE)` and renders the sketch only while active, so it replays. Move the page's id, `"sound.page"`, from `sound.module.ts` to `SOUND_PAGE` in `sound.ref.ts`, and use it in both files.

- [ ] **Step 3: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. In the app, the seal draws on each visit and shows finished under reduced motion.

```bash
git add src/ui src/index.css src/modules/sound
git commit -m "feat(sound): the seal draws itself on the empty page"
```
