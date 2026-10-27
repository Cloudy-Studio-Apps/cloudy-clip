# Architecture

Cloudy Clip is built so that **a user, an agent (over MCP), and a future plugin are equal editors**. They all go through one path: commands.

## Layers

```
┌──────────────────────── Webview (React) ────────────────────────┐
│  app/            shell: layout (top bar, side rail), keybinding │
│                  host, toasts, bootstrap (reads points;         │
│                  imports no module)                             │
│  ui/             UI kit: design tokens, stateless components    │
│  modules/        project · media · timeline · preview           │
│                  (each: index.ts, *.ref.ts, *.module.ts,        │
│                   *.types.ts, *.commands.ts, *.mcp.ts, ui/)     │
│  core/           command bus · history · stores · module host · │
│                  points · shell points · MCP registry + bridge  │
└───────────────▲──────────────────────────────▲──────────────────┘
                │ invoke / events              │ HTTP (Range)
┌───────────────┴──────── Rust (Tauri) ────────┴──────────────────┐
│  mcp/    MCP server (rmcp, 127.0.0.1:7420/mcp) + bridge         │
│  media/  file allowlist, FFmpeg proxies, loopback media server  │
└─────────────────────────────────────────────────────────────────┘
```

## How an edit flows

1. Something asks for a change: a button, a shortcut, or an MCP tool call.
2. It runs a **command** through the bus: `bus.run(splitAt, { at })` (typed) or `bus.execute("timeline.splitAt", input, { origin: "agent" })` (by id).
3. The bus validates the input with the command's Zod schema and queues the execution, so commands never interleave.
4. The command reaches the document with `ctx.require(projectRef).store` and changes it only with `ctx.mutate(store, draft => …)`. Immer records patches.
5. If it throws, every patch is rolled back. A `CommandFailure` becomes a typed error (`timeline.overlap`, …) and anything else becomes `internal`.
6. On success, undoable commands push one history entry `{ label, origin, patches }`. Ctrl+Z (or the agent's `history_undo`) applies the inverse patches, whoever made the change.
7. Zustand subscribers re-render only what changed. The preview redraws.

## How an agent call flows

```
agent ──HTTP──▶ rmcp server (Rust) ──event "mcp://call"──▶ mcp.bridge (webview)
                                                             │ validate, run tool
                                                             ▼
agent ◀──HTTP── rmcp server ◀──invoke "mcp_respond"──── tool result
```

- Tools live next to their module in `<module>.mcp.ts`. At startup the webview publishes the manifest (JSON Schema from Zod) with `mcp_register_tools`.
- Tools are thin: most are `commandTool(command, { name })`, so agents follow exactly the same rules and validation as the UI.
- Safety: the server binds to loopback only, rejects non-loopback `Host` headers and any browser `Origin`, and times out a call after 30 s.

## Modules and the future plugin API

A module is a `defineModule`:

```ts
export const timelineModule = defineModule({
  ref: timelineRef, // defineModuleRef<TimelineApi>("timeline"): commands "timeline.*", tools "timeline_*"
  name: "Timeline",
  tier: "core", // or "feature"; plugins leave it unset
  requires: ["project", "media", "preview"],
  commands: timelineCommands,
  mcpTools: timelineMcpTools,
  setup(ctx) {
    const timeline = createTimelineView(); // state for this kernel
    ctx.contribute(layoutPanels, { id: "timeline.panel", slot: "bottom", ... });
    ctx.contribute(keybindings, { id: "timeline.split", key: "s", resolve: () => ... });
    ctx.onDispose(project.subscribe(...)); // cleanup registered as soon as acquired
    return { api: timeline };
  },
});
```

`kernel.modules.loadAll(modules)` sorts by `requires`/`after` (cycles throw), registers each module's commands and tools, then runs `setup` once per kernel. A module whose `setup` throws is removed again (commands, tools, contributions) and marked `failed`; modules that need it are `skipped`; the rest keep working. Built-ins get no API a plugin will not have. A plugin loader only needs to produce module definitions and call `loadAll`.

- **APIs:** what `setup` returns as `api` is reached with `ctx.require(ref)` (setup, commands, MCP tools) or `useModule(ref)` (React). There are no module-level store or service singletons.
- **Points:** `definePoint<T>(id, { keyOf? })` is a typed place to contribute items; a keyed point rejects duplicate keys and names both modules. The shell reads `layoutPanels` (panels by slot; side panels become tabs of the rail, with their `icon`) and `keybindings` (each maps a key to a command, so shortcuts go through the bus). `usePoint(point)` reads one from React.
- **Tiers:** `core` modules may be required by anyone (lazily; list them in `requires` to use them during `setup`) and load before features; `feature` modules are written only against the public API and must list what they require.
- **`uses`:** must be loaded, loaded first when possible; mutual `uses` is allowed, so a `uses` module is only safe to `require` lazily.

Cross-module rules:

- Import other modules only through `@/modules/<name>` (their `index.ts`), and the kernel only through `@/core`. ESLint enforces this.
- Dependencies point one way: `project ← media ← preview ← timeline`.

## State

| Kind             | Example                      | Store                          | Undoable          |
| ---------------- | ---------------------------- | ------------------------------ | ----------------- |
| Document         | media, tracks, clips, format | `ProjectApi.store` (patchable) | yes               |
| Derived metadata | duration, size, poster       | `MediaApi.probes`              | no (re-derivable) |
| View             | zoom, selection              | `TimelineApi.view`             | no                |
| Playback         | playhead, playing            | `PreviewApi.playback`          | no                |

Every store and service is created by its module's `setup`, once per kernel.

All times are integer microseconds.

## Performance and stability

- **Hot paths skip React.** The playhead, timecode, and drag/trim feedback write to the DOM directly. A gesture sends one command on release.
- **The timeline is virtualized** by viewport-wide pages, so scrolling re-renders only when crossing a page.
- **Pro footage is proxied.** Files the webview can't decode well get an H.264 proxy from FFmpeg in the background, one encode at a time, cached across sessions.
- **Media is streamed.** The loopback server answers Range requests with bodies streamed from disk in 256 KB reads, so memory stays flat with long files.
- **Media elements are pooled.** At most a few stay warm; idle ones release their decoders.
- **The preview renders on demand.** It redraws every frame only while playing.
- **Failures stay contained.** Commands return `Result`, each panel has an error boundary, modules load in isolation, and Rust denies `unwrap`/`expect`/`panic` (release builds abort on panic).

## Platform notes

- **Linux (WebKitGTK):** GStreamer cannot read media from custom URI schemes, which is why media is served over loopback HTTP. H.264 needs the GStreamer libav plugin (`gst-libav`). VP9/WebM works with the base plugins.
- **Mobile:** the code is kept mobile-safe, but Android/iOS builds and touch editing are not part of v1.

## Deferred

Project save/load and autosave, export (engine and licensing), filmstrip thumbnails and waveforms, text/effects/transitions, mobile builds, the external plugin loader.
