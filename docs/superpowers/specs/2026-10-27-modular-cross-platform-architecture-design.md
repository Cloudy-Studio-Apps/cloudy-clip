# Modular, cross-platform architecture: design

_2026-10-27. Status: draft for approval._

## Intent

Cloudy Clip must grow like the rest of the Cloudy series (reference: `cloudy-canvas`): every
feature a self-contained module, a public API that built-ins and plugins share, and code a reader
can find their way around. It must run on **Linux and Windows now, macOS next and Android later**, and
adding Android must mean writing platform implementations, not changing the editor.

The editor will later gain templates, automatic transitions, effects and text (CapCut-style). The
structure must let each of those arrive as a module, without edits spread across the timeline,
the preview and the app shell. In particular, **changing how video is decoded (HTML media elements
today, WebCodecs or native decoding later) must touch one place only.**

This is a restructure of the existing v1 (media import, timeline, preview, MCP), not new
features. v1 behavior stays the same at the end, except where noted.

## Goals

1. A module API with **extension points** (`definePoint` / `contribute`), **tiers**
   (`core` / `feature`), **declared dependencies** (`requires` / `uses` / `after`) and **exports**,
   modeled on `cloudy-canvas` (`src/shared/core/modules/`) but built on Cloudy Clip's existing
   kernel (command bus, shared history, MCP registry), which stays as it is.
2. The app shell composes the UI **only from points**: it imports no module.
3. A **clip kinds** registry: the timeline, the preview and commands ask a clip's kind instead of
   branching on its type. Video and audio are the first two kinds.
4. A **platform layer**: every OS-specific capability behind an interface in `core`,
   implemented in `src/platform/`. Modules never import `@tauri-apps/*`.
5. A **media source abstraction**: the editor never handles file paths. It holds an opaque
   `MediaRef` and asks the platform to open it.
6. A **preview split into frame sources and a compositor**: decoding behind `FrameSource` /
   `AudioSource`, drawing in a WebGL2 compositor. Effects and transitions (later) only ever see
   GPU textures.
7. **A responsive layout**: one UI that rearranges by width; a narrow desktop window looks like
   the phone layout.
8. **Checks that keep it this way**: a module-rules script in `pnpm lint`, like canvas's
   `check-modules.mjs`.

## Non-goals

- New editing features (effects, transitions, text, templates, export). Only the seams for them.
- Android build, Android implementations, WebCodecs or native decoding. Only their interfaces and
  a capability report that would select them.
- i18n, a shared UI kit, pages (home, settings), a changelog. They come later; the layering below
  leaves room for them (`src/shared/ui`, `src/pages`).
- Saving/opening project files. (No file format exists yet; `MediaRef` is designed so one can
  store it.)

## Anti-goals (a failure even if it works)

- Any code outside the preview's decoding folder knowing about `<video>`/`<audio>` elements.
- A built-in module using anything a plugin could not.
- `if (clip.kind === "video")` anywhere outside the video kind's folder.
- Module-level singletons holding services (today `playback` and the engine in
  `preview.controller.ts`): services belong to a kernel instance, so tests and a future second
  window/session can create their own.
- A big-bang rewrite that leaves the app broken for days. Each stage leaves it working.

## Constraints

- Tauri v2, React 19 + TypeScript (strict), Tailwind, Zustand, Zod, pnpm, Vitest. No new
  framework.
- The CLAUDE.md rules stay: command bus for every mutation, shared undo, integer microseconds,
  no React state on per-frame paths, stable Zustand selectors, a virtualized timeline, TSDoc on
  every public export, a README per module.
- The media pipeline stays native: loopback HTTP media server (not a custom URI scheme), FFmpeg
  proxies (`PROXY_RECIPE`), WebKit's `requestVideoFrameCallback` rule. These are deliberate
  exceptions to canvas's "business logic in TypeScript, Rust only carries messages": process
  management, streaming and transcoding stay in Rust.
- MCP is **off on mobile** (user decision). The command bus is the same everywhere, so turning it
  on later is a platform switch, not an editor change.
- FFmpeg remains an external system binary on desktop for now (decision 2026-10-24). The
  transcoder interface must allow a bundled or platform-native implementation later.

## Decisions made with the user

| Decision               | Choice                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversion             | Inside Cloudy Clip (proxies), not a bridge to the separate mediaconverter app.                                                                                             |
| Mobile UI              | Same editor, responsive layout; tools move to the bottom on narrow widths.                                                                                                 |
| MCP on mobile          | Disabled.                                                                                                                                                                  |
| Non-path media         | An "open" interface; internals fetch content per platform.                                                                                                                 |
| Preview v1             | HTML media decoding (option 1) behind `FrameSource`, so a WebCodecs/native source can replace it without touching other code.                                              |
| Platforms verified now | **Linux and Windows.** The user and friends test on both; the user has a Windows machine. macOS must not be blocked by the design but is not built or tested in this work. |
| Baseline               | The proxy and media-server work is committed (`49a55ab`); stages start from it.                                                                                            |

## Target structure

```
src/
  app/                 shell: bootstrap, layout host (reads points), shortcuts host, providers
  core/                kernel, plain TS + its React bindings in core/react
    command/ history/ store/ errors/ ids/ time/ notifications/   (as today)
    module/            defineModule, definePoint, module host (sort, contribute, require)
    platform/          platform interfaces (types only) + `Platform` capability report
    mcp/               registry, bridge, protocol types (transport implementation moves out)
    react/
  platform/            implementations of core/platform interfaces
    tauri/             desktop (Linux, Windows, macOS): invoke/listen, dialogs, drag-drop,
                       media server, MCP transport
    (android/ later, or tauri/ + per-OS branches where Tauri covers it)
  modules/
    project/           core: document store, types, selectors, project commands
    media/             core: import, MediaRef, probe, proxies (through platform interfaces)
    timeline/          core: tracks, clips, gestures, lanes
    preview/           core: clock, compositor, frame/audio sources
      decode/          the ONLY folder that knows HTML media elements
      render/          WebGL2 compositor, render graph
      ui/
    video/  audio/     feature: the two clip kinds (ClipKind implementations, their lane and
                       inspector pieces)
  shared/ui/           (later) design system and kit
src-tauri/src/
  media/  mcp/  platform/ (capabilities report)   — one folder per module, as today
```

Each module keeps today's anatomy (`index.ts`, `<name>.types.ts`, `.commands.ts`, `.mcp.ts`,
`.store.ts`, `README.md`) and adds:

- `<name>.module.ts`: `defineModule({ id, tier, requires?, uses?, after?, exports, register })`.
  Wiring only.
- `<name>.points.ts`: the points it owns (a point lives in the module that reads it).
- `ui/`: all React for the module; `ui/index.ts` is its public UI API. Engine files (everything
  outside `ui/` and `.module.ts`) never import React, `ui/` or `@/platform`.

## What is a module and what is not

**Rule of thumb:** it is a module when it adds a capability the app could start without, through
the same API a plugin would use (commands, MCP tools, point contributions, exports). It is
infrastructure when it must exist before any module loads, when every module depends on it
unconditionally, or when it contributes nothing.

| Not a module                                                                                | Why                                                                                                                                                                  | Where                                 |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Kernel: command bus, history, patchable store, module host, points, MCP registry and bridge | Modules are loaded _by_ it                                                                                                                                           | `core/`                               |
| Platform implementations                                                                    | Chosen before modules load and handed to them through `ctx.platform`; a module must not be able to swap the OS out from under the others                             | `src/platform/`                       |
| App shell: bootstrap, layout host, shortcuts host, providers, error boundary                | Reads points; owns nothing a user edits                                                                                                                              | `src/app/`                            |
| Pure helpers: time/timecode, ids, geometry, `Result`                                        | Stateless functions; a module would only add ceremony                                                                                                                | `core/` (or a module's private files) |
| Design system / UI kit (later)                                                              | Shared building blocks with no behavior of their own                                                                                                                 | `src/shared/ui/`                      |
| A module's internals: gestures, ruler, playhead, placement logic                            | Parts of one feature, not separate capabilities                                                                                                                      | inside that module                    |
| Decoders (`FrameSource`s) and compositors                                                   | Interchangeable implementations of one contract, picked by `capabilities`. A `frameSources` point owned by `preview` lets a plugin add one, but each is not a module | `preview/decode/`, `preview/render/`  |
| Rust code                                                                                   | Tauri commands are registered per native folder, which mirrors the modules but is not the TS module system                                                           | `src-tauri/src/<module>/`             |

**Is a module:** `project`, `media`, `timeline`, `preview` (core), and every clip kind (`video`,
`audio`, later `text`, `image`), effect, transition, template pack and panel (features). Don't
create a separate `clip-kinds` module: the `clipKinds` point lives in `project`, which reads it.

## The parts

### 1. Module API (`core/module`)

Extends today's `ModuleDefinition` rather than replacing it:

```ts
defineModule({
  id: "timeline",
  tier: "core",                  // built-ins only; plugins leave it unset
  requires: ["project", "preview"],
  exports: { ...timelineApi },   // what host.require("timeline") returns
  commands: [...],               // as today
  mcpTools: [...],               // as today
  register(host) {               // contributions, synchronous
    host.contribute(layoutPanels, { id: "timeline", slot: "bottom", component: TimelinePanel });
  },
  activate(ctx) { ... },         // as today: listeners, background work
});
```

- `definePoint<T>(id, { keyOf? })` returns a typed token. Keyed points reject duplicate keys,
  naming both modules.
- The host sorts modules topologically (`requires` must exist and loads first; `uses` must exist;
  `after` only orders; cycles throw). The fixed array in `bootstrap.ts` becomes an unordered list.
- `ModuleContext` gains `require(id)` and `get(point)`, plus `platform` (see 4).
- Core modules never import features. A module imports another only through its `index.ts` /
  `ui/index.ts`, and only if it is core or listed in `requires`/`uses`.

### 2. Points the app shell reads

| Point          | Owner            | Holds                                                                                           |
| -------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| `layoutPanels` | app (core/ui)    | panel id, slot (`side` / `main` / `bottom` / `tools`), order, component, narrow-layout behavior |
| `keybindings`  | core             | command id → key combo; the shortcuts host reads it (replaces hard-coded `app/shortcuts.ts`)    |
| `toolbarItems` | timeline         | buttons in the timeline toolbar                                                                 |
| `contextMenu`  | timeline / media | entries by target (clip, track, media item)                                                     |
| `clipKinds`    | project          | `ClipKind` implementations, keyed by kind id                                                    |
| `importers`    | media            | which files a media kind accepts (replaces `ACCEPTED_EXTENSIONS` + Rust `kind_of` duplication)  |

`App.tsx` renders the slots from `layoutPanels`; it imports no module.

### 3. Clip kinds

A clip in the document gains `kind: string`. A `ClipKind` answers what the code now hard-codes:

```ts
interface ClipKind {
  id: string;                         // "video", "audio", later "text", "image", ...
  trackKinds: TrackKind[];            // which tracks accept it
  layers(clip, time, ctx): RenderLayer[];   // what the compositor draws (video: one texture layer)
  audio?(clip, time, ctx): AudioLayer | null;
  lane: ComponentType<ClipLaneProps>;      // how the clip looks on the timeline
  defaultDuration?(...): Micros;
}
```

Commands (`timeline.addClip`, split, trim, move) stay kind-agnostic: they work on `start`,
`duration`, `sourceIn`. Kind-specific validation is a kind method, not a branch.

### 4. Platform layer

Interfaces in `core/platform`, implementations in `src/platform/tauri`, chosen once in
`bootstrap.ts` and handed to modules through `ModuleContext.platform`.

| Interface                         | Does                                                            | Desktop (now)                                                      | Android (later)                                 |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| `Platform.capabilities`           | what this device supports                                       | `{ mcp: true, transcoder: "ffmpeg-system", decoders: [...] , os }` | `{ mcp: false, ... }`                           |
| `MediaSourceProvider`             | `pick()`, `open(ref)` → playable URL + metadata, `release(ref)` | file path → loopback server URL                                    | `content://` → stream with persisted permission |
| `Transcoder`                      | proxy decision + proxy jobs + progress                          | Rust FFmpeg pipeline (today's `proxy.rs`)                          | MediaCodec or bundled library                   |
| `FileDrop`                        | OS file drops                                                   | Tauri webview drag-drop                                            | Android share/intent                            |
| `NativeEvents` / `NativeCommands` | thin invoke/listen wrapper                                      | `@tauri-apps/api`                                                  | same (Tauri mobile)                             |
| `McpTransport`                    | as today                                                        | Tauri transport (moved here from core)                             | not started                                     |

`decoders` in the capabilities report is what decides the proxy rule per platform, instead of the
Linux-shaped hard-coded list in `proxy.rs`: Rust reports which codecs the current webview plays
(per-OS table at first, detected later), and the transcoder uses it.

### 5. Media sources: `MediaRef`

`MediaAsset.path: string` becomes `MediaAsset.source: MediaRef`, an opaque, serializable value
(`{ scheme: "file" | "content" | ..., id: string, displayName }`). Only the platform interprets
it. Rust keeps the id → source allowlist (today's registry). The MCP `media_import` tool still
accepts paths on desktop; the platform turns them into `MediaRef`s.

### 6. Preview: frame sources and compositor

```
PlaybackClock (owns time)
   └─ PreviewController: asks each visible clip's kind for layers at time T
        └─ Compositor (WebGL2): draws layers bottom → top into the project format
             └─ asks FrameSource.frameAt(mediaId, sourceTime) → texture or "not ready"
AudioSource: keeps audio in sync with the clock (v1: the media elements' own audio)
```

- `FrameSource` interface: `prepare(mediaId, time)`, `frameAt(mediaId, time)` (a
  `TexImageSource` or `null` while decoding), `isSettled()`, `release(...)`, `dispose()`.
- v1 implementation `HtmlMediaFrameSource` + `HtmlMediaAudioSource` in `preview/decode/`: today's
  pooled elements, drift correction, `requestVideoFrameCallback` waiting and proxy URL reloads,
  moved out of `HtmlMediaEngine` unchanged in behavior.
- The compositor keeps today's rule: paint only when every visible layer has its frame, otherwise
  keep the previous picture.
- Later, `WebCodecsFrameSource` is a new file in `decode/` chosen from `capabilities`; nothing
  else changes. The same compositor will render export frames, so export matches the preview.

### 7. Responsive layout

The layout host places `layoutPanels` by slot. Above a breakpoint (my call: 900 px wide), today's
arrangement; below it, preview on top, timeline in the middle, side/tool panels as a bottom bar
with sheets. Breakpoint from window width, so a narrow desktop window shows the phone layout.
Touch input on timeline gestures uses pointer events (already the case) with larger hit targets
under the breakpoint.

### 8. Checks

`scripts/check-modules.mjs` (in `pnpm lint`): every module has `index.ts`, `<name>.module.ts`,
`README.md` and `tier`; no deep imports; imports only of core modules or `requires`/`uses`; core
never imports features; engine files import no React, `ui/` or `@/platform`; only `src/platform`
imports `@tauri-apps/*`; only `preview/decode/` references `HTMLMediaElement`.

## Stages (each leaves the app working and committed)

1. **Module API and points.** `defineModule`, `definePoint`, host with sorting, `exports`,
   `require`. Existing modules migrate to it with no behavior change. Layout and keybindings
   become points; `App.tsx` stops importing modules.
   1b. **Per-kernel state.** Stores and services created per kernel; `exports(ctx)` factories;
   `useModule(id)`; module singletons removed.
2. **Platform layer.** Interfaces, `src/platform/tauri`, capabilities report (Rust + TS), MCP
   started only when `capabilities.mcp`. All `@tauri-apps` imports move.
3. **MediaRef.** `path` → `source: MediaRef`, `MediaSourceProvider`, importers point; Rust
   registry keyed by ref.
4. **Clip kinds.** `ClipKind`, `clipKinds` point, `video` and `audio` feature modules; timeline
   and preview ask kinds.
5. **Preview split.** `FrameSource`/`AudioSource`, `HtmlMedia*` sources, WebGL2 compositor;
   services owned by the kernel instead of module singletons.
6. **Responsive layout.**
7. **Windows.** Make it build and run on Windows and verify there: `ffmpeg.exe`/`ffprobe.exe` lookup (app `bin`, beside the exe, `PATH`; no console window), Windows paths in `MediaRef`, the loopback media server and MCP in WebView2, WebView2's codec list in the capabilities report, the WebGL2 compositor. A GitHub Actions workflow builds Linux and Windows on every push; the user tests the Windows build by hand. (Windows-specific fixes found earlier can land in their own stage.)
8. **Checks and docs.** `check-modules.mjs`, CLAUDE.md rules, `docs/architecture.md`, module
   READMEs.

(8's rules can land incrementally with each stage; listed last for clarity.)

## Calls made by the designer (not decided with the user; open to review)

1. **Stores move into the kernel instance too, not only services.** `projectStore`,
   `mediaProbeStore`, the timeline store, the drop store, the clock and the preview are created
   per kernel. Modules stop exporting store instances from `index.ts`.
2. **`exports` is a factory: `exports(ctx) => Api`.** The host calls it once per kernel after the
   module's dependencies are loaded. `ctx.require(id)` returns that object. React reaches it with
   `useModule(id)` (through `KernelProvider`); `ui/index.ts` exports components and hooks, never
   service instances. Types stay importable statically from `index.ts`. Plugins get the same
   factory shape. Because this changes nearly every import, it is its own stage (1b below).
3. **The compositor has two implementations behind one `Compositor` interface: WebGL2 by
   default, Canvas2D as a fallback.** Canvas2D is used when WebGL2 is unavailable, when it runs in
   software, or when video texture upload fails, and `capabilities` reports which one is active.
   Effects and transitions that need shaders report "unsupported on this device" under Canvas2D
   instead of rendering wrong. `preview_capture_frame` reads pixels from whichever one is active.
4. **Breaking changes to MCP output are allowed.** There are no external users yet.
   `media.path` becomes `media.source` (with `displayName`), clips gain `kind`, and tools and
   READMEs are updated to match. Desktop `media_import` keeps accepting paths. No compatibility
   layer.
5. **If a module fails to load, every module that `requires` it is skipped and reported.** Modules
   that only list it in `uses` are skipped too, because `uses` means "must be loaded".

## Left to the builder

- Exact names and file splits inside each module, within the anatomy above.
- How the capabilities report detects decoders (static per-OS table is fine for now).
- WebGL2 details (shader layout, texture upload strategy), as long as frame drawing behavior and
  the "paint only when settled" rule are preserved.
- Test coverage per stage, following the existing Vitest style (node environment, no DOM): the
  module host and points get unit tests; WebGL is verified in the running app.
