# Architecture

Cloudy Clip is built so that **a user, an agent (over MCP), and a future plugin are equal editors**. They all go through one path: commands.

## Layers

```
┌──────────────────────── Webview (React) ────────────────────────┐
│  app/            shell: layout, shortcuts, toasts, bootstrap    │
│  modules/        project · media · timeline · preview           │
│                  (each: index.ts, *.types.ts, *.commands.ts,    │
│                   *.mcp.ts, components/, README.md)             │
│  core/           command bus · history · stores · module        │
│                  registry · MCP registry + bridge               │
└───────────────▲──────────────────────────────▲──────────────────┘
                │ invoke / events              │ HTTP (Range)
┌───────────────┴──────── Rust (Tauri) ────────┴──────────────────┐
│  mcp/    MCP server (rmcp, 127.0.0.1:7420/mcp) + bridge         │
│  media/  file allowlist + loopback media server                 │
└─────────────────────────────────────────────────────────────────┘
```

## How an edit flows

1. Something asks for a change: a button, a shortcut, or an MCP tool call.
2. It runs a **command** through the bus: `bus.run(splitAt, { at })` (typed) or `bus.execute("timeline.splitAt", input, { origin: "agent" })` (by id).
3. The bus validates the input with the command's Zod schema and queues the execution, so commands never interleave.
4. The command changes state only with `ctx.mutate(projectStore, draft => …)`. Immer records patches.
5. If it throws, every patch is rolled back. A `CommandFailure` becomes a typed error (`timeline.overlap`, …) and anything else becomes `internal`.
6. On success, undoable commands push one history entry `{ label, origin, patches }`. Ctrl+Z (or the agent's `history_undo`) applies the inverse patches, whoever made the change.
7. Zustand subscribers re-render only what changed. The preview redraws.

## How an agent call flows

```
agent ──HTTP──▶ rmcp server (Rust) ──event "mcp://call"──▶ mcp-bridge (webview)
                                                             │ validate, run tool
                                                             ▼
agent ◀──HTTP── rmcp server ◀──invoke "mcp_respond"──── tool result
```

- Tools live next to their module in `<module>.mcp.ts`. At startup the webview publishes the manifest (JSON Schema from Zod) with `mcp_register_tools`.
- Tools are thin: most are `commandTool(command, { name })`, so agents follow exactly the same rules and validation as the UI.
- Safety: the server binds to loopback only, rejects non-loopback `Host` headers and any browser `Origin`, and times out a call after 30 s.

## Modules and the future plugin API

A module is a `ModuleDefinition`:

```ts
export const timelineModule: ModuleDefinition = {
  id: "timeline", // namespace: commands "timeline.*", tools "timeline_*"
  name: "Timeline",
  commands: timelineCommands,
  mcpTools: timelineMcpTools,
  activate(ctx) {
    /* listeners; return a disposer */
  },
};
```

The registry registers the declarative parts, calls `activate`, and isolates failures: a module that throws is unloaded and the rest keep working. Built-ins get no API a plugin will not have. A plugin loader only needs to produce `ModuleDefinition`s and call `kernel.modules.load`.

Cross-module rules:

- Import other modules only through `@/modules/<name>` (their `index.ts`), and the kernel only through `@/core`. ESLint enforces this.
- Dependencies point one way: `project ← media ← timeline`, and `project ← media ← preview ← timeline (playhead)`.

## State

| Kind             | Example                      | Store                      | Undoable          |
| ---------------- | ---------------------------- | -------------------------- | ----------------- |
| Document         | media, tracks, clips, format | `projectStore` (patchable) | yes               |
| Derived metadata | duration, size, poster       | `mediaProbeStore`          | no (re-derivable) |
| View             | zoom, selection              | `timelineViewStore`        | no                |
| Playback         | playhead, playing            | `PlaybackClock`            | no                |

All times are integer microseconds.

## Performance and stability

- **Hot paths skip React.** The playhead, timecode, and drag/trim feedback write to the DOM directly. A gesture sends one command on release.
- **The timeline is virtualized** by viewport-wide pages, so scrolling re-renders only when crossing a page.
- **Media is streamed.** The loopback server answers Range requests with bodies streamed from disk in 256 KB reads, so memory stays flat with long files.
- **Media elements are pooled.** At most a few stay warm; idle ones release their decoders.
- **The preview renders on demand.** It redraws every frame only while playing.
- **Failures stay contained.** Commands return `Result`, each panel has an error boundary, modules load in isolation, and Rust denies `unwrap`/`expect`/`panic` (release builds abort on panic).

## Platform notes

- **Linux (WebKitGTK):** GStreamer cannot read media from custom URI schemes, which is why media is served over loopback HTTP. H.264 needs the GStreamer libav plugin (`gst-libav`). VP9/WebM works with the base plugins.
- **Mobile:** the code is kept mobile-safe, but Android/iOS builds and touch editing are not part of v1.

## Deferred

Project save/load and autosave, export (engine and licensing), filmstrip thumbnails and waveforms, text/effects/transitions, mobile builds, the external plugin loader.
