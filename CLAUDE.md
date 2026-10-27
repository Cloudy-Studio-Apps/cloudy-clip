# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cloudy Clip is an open-source video editor in the spirit of CapCut. It is meant to be easy and comfortable, unlike DaVinci Resolve or After Effects. It focuses on short-form video but must also handle long videos. It targets **desktop and mobile** through Tauri v2, with a React + TypeScript + Tailwind CSS frontend.

Two product ideas drive the architecture:

1. **Agents are first-class editors.** An MCP server is built in and on by default. An agent can do anything a user can do, on the same live project. The user can keep editing after the agent, or ask it to take over one part. Neither side has powers the other lacks.
2. **Plugins come later, but the API is designed now.** Internal modules register themselves through the same surface that third-party plugins will use.

### Scope of v1

Only these: **media import, timeline, timeline preview.** No export, effects, text, audio mixing, or AI features yet. Do not scaffold modules beyond v1 scope unless asked.

## Commands

The package manager is **pnpm** (`tauri.conf.json` runs `pnpm dev` / `pnpm build`).

```sh
pnpm install
pnpm tauri dev                 # run the desktop app (Vite on :1420 + Rust; MCP on 127.0.0.1:7420)
pnpm tauri build               # production bundle
pnpm build                     # typecheck + Vite build of the frontend only
pnpm typecheck                 # tsc
pnpm lint                      # ESLint (incl. module-boundary rule) + Prettier check
pnpm format                    # Prettier write
pnpm test                      # Vitest, all tests
pnpm vitest run src/modules/timeline/logic/placement.test.ts -t "snaps"   # one file / one test
cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
```

Frontend tests live next to the code as `*.test.ts` (node environment, no DOM). Rust lints deny `unwrap`/`expect`/`panic` outside tests (`Cargo.toml` `[lints.clippy]`, `clippy.toml`).

Connect an agent to a running app: `claude mcp add --transport http cloudy-clip http://127.0.0.1:7420/mcp` (port override: `CLOUDY_CLIP_MCP_PORT`).

## Architecture rules

### 1. Modules: everything for a feature lives in one folder

```
src/
  core/                    # kernel: command bus, history, module/plugin registry, MCP bridge
  modules/
    <module>/
      index.ts             # public API, the ONLY file other modules may import
      <module>.types.ts    # all types for the module
      <module>.commands.ts # commands this module registers
      <module>.mcp.ts      # MCP tools this module registers
      <module>.store.ts    # module state
      components/          # React UI for the module
      README.md            # what the module owns, its commands, its MCP tools
```

- **Every type file ends in `.types.ts`.** Do not put types inline in other files. Exception: a component's own props type.
- A module **must not** reach into another module's internals. Import only from `@/modules/<other>` and `@/core` (enforced by ESLint `no-restricted-imports`). Inside a module use relative imports.
- Each module registers itself with `core` through a `ModuleDefinition` (`src/core/module/module.types.ts`): an id, commands, MCP tools, and `activate()`. Built-ins are loaded in `src/app/bootstrap.ts`. Plugins will use that same definition shape later, so do not give internal modules shortcuts that a plugin could not use.
- The Rust side mirrors this layout: `src-tauri/src/<module>/` per module, with Tauri commands registered from each module, not one big `lib.rs`.

### 2. All mutations go through the command bus

Every action that changes the project, such as importing a file, adding a clip, moving or splitting a clip, or seeking, is a **named, typed, serializable command** run through `core`. This is how UI, MCP agents, and plugins stay equal:

- UI handlers run commands. They never mutate stores directly.
- `<module>.mcp.ts` tools are thin wrappers that validate input and run commands. They never hold their own logic.
- Every command execution records its **origin** (`user` | `agent` | `plugin`). Undoable commands go into **one shared undo history**, so Ctrl+Z can undo an agent's change.
- Commands are defined with `defineCommand` (Zod input schema), change state only via `ctx.mutate(store, draft => …)` on a `PatchableStore`, and throw `CommandFailure(code, message)` for expected errors. The bus validates, serializes executions, rolls back on throw, times out after 30 s, and never throws (returns `Result`).
- Document state (the project: media, tracks, clips) lives in `projectStore` (patchable, undoable). Ephemeral state (selection, zoom, probe metadata, playhead) lives in plain Zustand stores and is never in history. Non-undoable commands must not mutate patchable stores.
- All times are integer **microseconds** (`Micros`).
- Project state must be readable as structured data (tracks, clips, times), so an agent can inspect it, not only the UI.

### 3. MCP

- Each module declares its tools in `<module>.mcp.ts`. Nothing outside the module defines that module's tools. Tool names are `snake_case` prefixed with the module id; most are `commandTool(command, { name })`.
- The server is hosted in Rust (`src-tauri/src/mcp`, official `rmcp` SDK, Streamable HTTP on `127.0.0.1:7420/mcp`, loopback hosts only, any browser `Origin` rejected). At startup the webview publishes the tool manifest (`mcp_register_tools`); each call is forwarded as an `mcp://call` event, run by `src/core/mcp/mcp-bridge.ts`, and answered with `mcp_respond` (30 s timeout).

### 4. Media and preview

- Files are registered natively (`media_register`, an id → path allowlist) and streamed by a **loopback HTTP server** (`src-tauri/src/media/server.rs`, random port + per-session token, Range support, streamed bodies). Do not switch back to a custom URI scheme: WebKitGTK's GStreamer pipeline cannot read media from custom schemes.
- Media elements use `crossOrigin = "anonymous"` so canvas frames can be read (poster capture, `preview_capture_frame`); the server sends `Access-Control-Allow-Origin: *`.
- **Proxies** (`src-tauri/src/media/proxy.rs`): on register, `ffprobe` decides if a file is webview-friendly (H.264/VP8/VP9, 8-bit 4:2:0, ≤ 60 Mbps, ≤ 4K, web audio). Otherwise the system `ffmpeg` makes an H.264/AAC proxy (long side 1280, GOP 15, one encode at a time) in the app cache dir, keyed by `PROXY_RECIPE` + path + size + mtime; the server then streams the proxy and the original is kept for export. Progress goes to the webview as `media://proxy` events. Proxies must contain only one video and one audio stream with no timecode/data tracks (`-dn -write_tmcd 0 -map_metadata -1`), or WebKitGTK shows no frames. Bump `PROXY_RECIPE` whenever the recipe changes.
- Metadata (duration, size, poster) is probed in the webview (`media.probe.ts`, concurrency 2) once the proxy pipeline has settled. `mediaUrl()` changes when a proxy is ready, which makes media elements reload.
- WebKit fires `seeked` before the frame is decoded. Never draw a video frame on `seeked`; wait for `requestVideoFrameCallback` (with a timeout fallback). The engine only paints when every visible layer has its frame and keeps the previous picture otherwise.
- Preview: `PlaybackClock` (rAF, owns the playhead) drives a `PreviewEngine`; v1 is `HtmlMediaEngine` (pooled media elements + 2D canvas). Export is deferred. FFmpeg is used as an external system binary (user decision, 2026-10-24); bundling it is a later decision with licensing implications.

### 5. Performance rules

- No React state on per-frame paths: the playhead, timecode, and drag/trim feedback update DOM directly (refs, `style.transform`). Gestures send **one command on release**.
- Zustand selectors must return stable references (select raw slices, derive with `useMemo`), or React re-renders forever.
- The timeline is virtualized by viewport-wide pages; keep it that way when adding lane content.

## Code standards

- Write for readers: clear names, small files, and a TSDoc comment on every exported symbol of a module's `index.ts` and on every command and MCP tool, because those are the future plugin API.
- Keep each module's `README.md` up to date when its commands or MCP tools change.
- Strict TypeScript (already on in `tsconfig.json`). Do not use `any` in public APIs.

## Current state

v1 is implemented: `core` (kernel), modules `project`, `media`, `timeline`, `preview`, the app shell in `src/app`, and native `media` + `mcp` modules. Architecture walkthrough: `docs/architecture.md`. Each module has a `README.md`. The Tauri identifier is `com.darkredgm.cloudy-clip`.
