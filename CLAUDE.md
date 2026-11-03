# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Cloudy Clip (by DarkRedgm, part of the Cloudy Studio family with Cloudy Canvas) is an open-source video editor in the spirit of CapCut: easy and comfortable, unlike DaVinci Resolve or After Effects. It focuses on short-form video but must handle long videos. It is built with Tauri 2, React 19, Vite, TypeScript (strict, `noUncheckedIndexedAccess`), Tailwind v4, Zustand, Immer and Zod. Targets: Linux and Windows now, macOS next, Android later (desktop and mobile through Tauri).

Two product ideas drive the architecture:

1. **Agents are first-class editors.** An MCP server is built in and on by default. An agent can do anything a user can do, on the same live project, and the user can undo it. Neither side has powers the other lacks.
2. **Plugins come later, but the API is designed now.** Built-in modules register through the same surface third-party plugins will use.

**Scope of v1:** media import, timeline, timeline preview (plus the inspector, canvas transforms, linked picture/sound clips, clip sound controls, constant clip speed with Freeze frame and Reverse, text clips with full styling and fonts, junctions with transitions between clips, and stickers in packs, keyframes on values and sound with curves, and speed ramps). Projects save and reopen (workspace), and compositions export to files (export). No picture effects or AI features yet. Do not scaffold modules beyond this unless asked.

## Commands

The package manager is **pnpm**.

```sh
pnpm install
pnpm tauri dev      # desktop app (Vite on :1420 + Rust; MCP on 127.0.0.1:7420)
pnpm tauri build    # production bundle
pnpm build          # typecheck + Vite build of the frontend only
pnpm typecheck      # tsc
pnpm lint           # ESLint (incl. the module-boundary rule) + Prettier check
pnpm format         # Prettier write
pnpm test           # Vitest, all tests (node environment, no DOM)
pnpm vitest run src/modules/timeline/logic/placement.test.ts -t "snaps"   # one file / one test
cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
```

Connect an agent to a running app: `claude mcp add --transport http cloudy-clip http://127.0.0.1:7420/mcp` (port override: `CLOUDY_CLIP_MCP_PORT`).

## Rules

These are the rules, and they are strict. How things work is described in the `README.md` next to the code (see Where to look). How a module is laid out and filled in is in [docs/modules.md](docs/modules.md).

**Before you change code**

1. Read the `README.md` of the folder you change and of the module it belongs to. When you change how something works (a command, a tool, an API, a point, a contribution), update that README in the same change, in the [README template](docs/modules.md#readme-template).
2. A change is done when `pnpm typecheck`, `pnpm lint` and `pnpm test` all pass. Rust changes also pass `cargo clippy --all-targets -- -D warnings` and `cargo test`.
3. Tests are for core parts only, or where absolutely necessary. A test earns its place if it covers the kernel (`src/core`), the integrity of the document (clip placement, overlaps, links, junction validity, undoable timeline and junction commands), or a bug nothing else would catch. Anything else gets no test, and a test that doesn't qualify is deleted. Being testable is not a reason.

**Layering** (enforced by ESLint `no-restricted-imports`)

4. Path alias `@/` is `src/`. Other code is reached only through public entry points: `@/core` (the kernel), `@/ui` (the UI kit), `@/modules/<name>` (a module's `index.ts`). Never deep-import (`@/core/command/…`, `@/modules/timeline/ui/…`, `@/ui/kit/…`). Inside a module or folder, use relative imports.
5. Lower layers never know higher ones: `core` imports no module, no `@/ui` and no `@/app`; `ui` imports nothing but React and its own files; modules never import `@/app`. The shell (`src/app`) reads points only; `bootstrap.ts` is the one file that lists modules.
6. Native access (Tauri `invoke`, events, dialogs) lives in the module that owns it (`media.service.ts`, `media.pick.hook.ts`) or in `core/mcp/mcp.transport.tauri.ts`. Business logic lives in TypeScript. `src-tauri/` holds the native media server, proxies and the MCP server, one folder per module, with each module registering its own Tauri commands (not one big `lib.rs`).

**Modules** ([docs/modules.md](docs/modules.md))

7. New functionality is a module: one folder in `src/modules/<name>/` with the required files of [Module anatomy](docs/modules.md#module-anatomy) (`index.ts`, `<name>.ref.ts`, `<name>.module.ts`, `<name>.types.ts`, `README.md`), listed in `src/app/bootstrap.ts`. Follow the [new module checklist](docs/modules.md#new-module-checklist).
8. A module's `tier` is `core` (the app can't exist without it) or `feature` (written only against public APIs, as a plugin would be). Core modules never require features. A feature uses nothing a plugin couldn't: when it needs something private, export it from the owning module's `index.ts` instead of reaching in.
9. Declare what you use: every module you `require` in `setup`, a command, a tool or a component is listed in `requires` (or `uses`), and nothing is listed that isn't used.
10. A feature owns its whole surface: its commands, MCP tools, UI and contributions live in its folder, even when the data it edits lives in `project`. Don't add a feature's command to another module.
11. `<name>.module.ts` is wiring only: `defineModule`, `ctx.contribute`, creating stores and services. No logic.
12. **No module-level singletons** for state or services. `setup(ctx)` runs once per kernel and creates them (store factories in `<name>.store.ts`), registering each cleanup with `ctx.onDispose` right after acquiring it.
13. A point lives in the module that reads it (`<name>.points.ts`). The shell reads `layoutPanels`, `keybindings`, `topBarItems`, `appOverlays`, `appPages`, `appPageGroups` and `appMenuItems`; the timeline reads `timelineOverlays`, `timelineTabs`, `timelineTools` and `timelineDocks`; `media` reads `librarySections` and `libraryKinds`; the preview reads `previewOverlays`; `element` reads `elements`, `sharedGroups` and `propTypes`; the inspector reads `propertyControls`, `sectionLayouts`, `inspectorTabs`, `inspectorSections` and `fieldActions`; `sticker` reads `stickerPacks` and `stickerStyles`; `keyframe` reads `keyTargets`.

**Commands and state**

14. Every change to the project (and every action an agent can take, like seeking) is a command (`defineCommand`, Zod input, `<module>.<action>` id) run through the bus. UI handlers and MCP tools run commands; they never mutate stores.
15. Commands change state only with `ctx.mutate(store, draft => …)`, throw `CommandFailure("<module>.<reason>", message)` for expected errors, and validate everything before writing. A gesture sends one command on release, so it is one undo step.
16. Document state (media, tracks, clips) lives only in the project store (`ctx.require(projectRef).store`): patchable and undoable. Ephemeral state (selection, zoom, viewport, probes, playhead, live gesture values) lives in plain per-kernel Zustand stores and is never in history. Non-undoable commands never mutate the project, except `ctx.replace`, which starts another document.
17. All times are integer microseconds (`Micros`). Positions in the frame are output pixels. Ids come from `createId()`.

**MCP**

18. A module's tools live in its `<name>.mcp.ts`, nothing outside the module defines them. Tool names are `snake_case` and start with the module id (`timeline_split`, `transform_reset`). Editing tools are `commandTool(command, { name })`: a thin wrapper with no logic of its own.
19. The project must stay readable as structured data (`project_get_state`), so an agent can inspect everything the UI shows.

**Media and preview** (hard-won; see `src/modules/media/README.md` and `src/modules/preview/README.md`)

20. Media is streamed by the loopback HTTP server, never a custom URI scheme (WebKitGTK's GStreamer can't read those). Media elements use `crossOrigin = "anonymous"`.
21. Proxies contain one video and one audio stream with no timecode/data tracks (`-dn -write_tmcd 0 -map_metadata -1`), or WebKitGTK shows no frames. Bump `PROXY_RECIPE` whenever the recipe changes. FFmpeg is the external system binary. Export never draws from a proxy: a file with one gets a full-size master under the same rules.
22. Never draw a video frame on `seeked`: wait for `requestVideoFrameCallback` (with the timeout fallback). The engine paints only when every visible layer has its frame.
23. Where a clip's picture sits is computed only by `clipPlacement()` (`project`) with its element's picture size and fit, so the engine and the canvas tools always agree. Every kind of clip is an element (`defineElement`, see `docs/modules.md`); never branch on `clip.kind` outside the module that owns the element.

**Performance**

24. No React state on per-frame paths: the playhead, timecode, drag/trim/transform feedback, panel resizing and viewer zoom/pan update the DOM directly (refs, `style`). Subscribe imperatively and re-render only when the result changes.
25. Zustand selectors return stable references (select raw slices, derive with `useMemo`).
26. The timeline is virtualized by viewport-wide pages; keep it that way when adding lane content.

**Code**

27. Small, single-purpose files: one component, hook, gesture or concern per file. Split a file once it mixes concerns or grows past ~200 lines.
28. File names are dotted, never hyphenated: `<area>.<role>.ts`, where area is the module or folder (`timeline.clip.commands.ts`, `mcp.bridge.ts`, `engine.slots.ts`). Hooks are `<name>.hook.ts`; components are `PascalCase.tsx`; one-word files in `logic/` (`placement.ts`, `picking.ts`) need no area. Tests are `<file>.test.ts`, next to the code. `vite-env.d.ts` is the only exception.
29. Every `interface` and `type` goes in a `.types.ts` file (the module's `<name>.types.ts`, or `<area>.types.ts` for a folder), imported with `import type`. Exceptions: a component's own props (and state) type, and fixtures inside tests.
30. Pure logic (geometry, hit tests, snapping, placement) lives in `logic/`, never inside components or gestures.
31. Strict TypeScript, no `any` in public APIs. Every export of a module's `index.ts`, every command and every MCP tool has a TSDoc comment: they are the future plugin API.
32. Report failures to the user through command results or `notify(…)`, never only `console`. Use the module's logger (`ctx.log` / `createLogger`).

**UI**

33. Reuse before writing: the kit in `@/ui` (`Button`, `IconButton`, `SegmentedControl`, `ToolbarButton`, `EmptyState`, `ProgressBar`, `Waveform`, `Kbd`, `FoldSection`, `SealMark`, `SealSketch`, `SketchPage`, `cn`). A piece a second module needs moves to `@/ui` instead of being copied. Icons come from `lucide-react`.
34. Components use semantic tokens only (`bg-surface`, `text-muted-foreground`, `border-border`, `bg-primary`, `bg-clip-video`, …). Tailwind's default palette is reset, so `bg-neutral-900` doesn't exist; palette scales (`ice`, `seal`, `blush`, `sand`) are for brand art and media badges only.
35. Sharp shapes: `rounded-xs` (2px) to `rounded-lg` (8px), nothing above 8px, no pills (only avatars, switch and slider thumbs, EQ points and curve handles are round). Type scale is `text-2xs`…`text-md` (10–14px), plus `text-display` for the wordmark. UI fonts are Shantell Sans (`font-hand`, for titles, tabs and buttons), Atkinson Hyperlegible and Courier Prime (Fontsource, offline). Inter and JetBrains Mono stay bundled for text clips. The look follows `docs/prototype/designs/b-mesa-de-noche.html`.
36. The seal (`SealMark`) appears in light touches only: the logo, empty states, waiting. Never as clutter. `SealMark` is the foca watona: spotted, with dark deadpan open eyes.

## Where to look

```
src/
  core/         the kernel: command bus, history, patchable stores, module host, points,
                shell points, MCP registry + bridge, errors, React bindings
  app/          the shell: bootstrap (lists modules), layout (top bar, side rail, resizable
                regions), keybinding host, toasts. Reads points; imports no module UI
  ui/           the UI kit: design tokens (styles/), stateless components (kit/), brand (SealMark)
  modules/      one folder per module (see docs/modules.md)
    project/    the document: compositions, media, tracks, clips; selectors; clip placement
    element/    kinds of clip: element declarations, shared groups, prop types, element.setProps
    junction/   what sits on a cut between two clips: junction kinds and their registry
    fonts/      font families (bundled, installed, Google) and face loading
    media/      import, probing, proxies, the library panel
    preview/    playback clock, preview engine, viewer zoom/pan, the preview panel
    timeline/   track and clip commands, the timeline panel
    composition/ settings of a timeline, the dialog, Library section and tabs, placing one in another
    inspector/  the right column, panels generated from elements, controls (feature)
    transform/  the transform shared group, move/scale/rotate on the canvas (feature)
    text/       text clips: the Text tab, styling, in-place editing (feature)
    transition/ the transition junction kind, the seven presets, the Transitions tab (feature)
    sticker/    packs, topics and variations, the Stickers tab, static and animated art (feature)
    keyframe/   keys on a clip's values over time: diamonds, the Keyframes and Curves panel, motion path (feature)
    audio/      how a clip sounds: volume, pan, fades, EQ, pitch, the inspector's Audio tab (feature)
    speed/      how fast a clip plays: the box over the clip, the Speed section, Freeze frame, Reverse (feature)
    solid/      solid colors: the element, library items, the dialog (feature)
    collab/     agents as collaborators: presence, access, pointer, Follow (feature)
    tint/       the Tint page, for colors, empty for now (feature)
    sound/      the Sound page, empty for now (feature)
    export/     the Export page and queue: frames from the preview engine, sound mixed by FFmpeg (feature)
    workspace/  the open project: start dialog, save, autosave, open, recent list
src-tauri/      the Rust side: native media server + proxies (media/), export through FFmpeg (export/), installed fonts (fonts/), MCP server (mcp/), project files (workspace/)
```

| Topic                                                  | README                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Module anatomy, tiers, imports, README template        | [docs/modules.md](docs/modules.md)                                                |
| Architecture walkthrough (how an edit and a call flow) | [docs/architecture.md](docs/architecture.md)                                      |
| The kernel                                             | [src/core/](src/core/README.md)                                                   |
| The UI kit and tokens                                  | [src/ui/](src/ui/README.md)                                                       |
| Each module                                            | `src/modules/<name>/README.md`                                                    |
| The restructure plan (platform layer, next stages)     | `docs/superpowers/specs/2026-10-27-modular-cross-platform-architecture-design.md` |

The Tauri identifier is `com.darkredgm.cloudy-clip`.
