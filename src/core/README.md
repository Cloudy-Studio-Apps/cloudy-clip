# core

The kernel. Modules and (later) plugins import it only through `@/core`.

| Piece                    | Where                             | What it does                                                                               |
| ------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------ |
| Command bus              | `command/`                        | Validates (Zod), serializes, runs, rolls back on throw, times out at 30 s, never throws.   |
| History                  | `history/`                        | One shared undo/redo stack of Immer patches, tagged with origin (`user`/`agent`/`plugin`). |
| Patchable stores         | `store/`                          | Zustand stores whose changes are recorded as patches. Changed only via `ctx.mutate`.       |
| Module registry          | `module/`                         | Loads `ModuleDefinition`s; a module that fails to activate is unloaded and isolated.       |
| MCP                      | `mcp/`                            | Tool registry, `commandTool` helper, bridge to the native server.                          |
| Errors                   | `errors/`                         | `Result`, `CommandFailure`, scoped logger, panel `ErrorBoundary`.                          |
| Time, ids, notifications | `time/`, `ids/`, `notifications/` | `Micros` helpers, readable ids, toasts.                                                    |

Built-in commands: `history.undo`, `history.redo`. MCP tools: `history_undo`, `history_redo`, `history_list`.
