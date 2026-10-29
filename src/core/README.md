# core

The kernel. Modules and (later) plugins import it only through `@/core`.

| Piece                    | Where                             | What it does                                                                                                                                                                              |
| ------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command bus              | `command/`                        | Validates (Zod), serializes, runs, rolls back on throw, times out at 30 s, never throws. `CommandInputs` maps ids to inputs (modules extend it), `PanelCommandId` = ids taking `clipIds`. |
| History                  | `history/`                        | One shared undo/redo stack of Immer patches, tagged with origin (`user`/`agent`/`plugin`).                                                                                                |
| Patchable stores         | `store/`                          | Zustand stores whose changes are recorded as patches. Changed only via `ctx.mutate`.                                                                                                      |
| Module host              | `module/`                         | `defineModule`/`defineModuleRef`; orders by `requires`/`after`, runs `setup` per kernel, `require(ref)`, `onDispose`; failures isolated (cleanups run), dependents skipped.               |
| Points                   | `module/points.ts`                | `definePoint`; per-kernel registry of contributions (keyed points reject duplicates).                                                                                                     |
| Shell points             | `shell/`                          | `layoutPanels`, `keybindings`, `matchKeybinding`: what the app shell renders and runs. Side panels show as rail tabs (`title`, `icon`).                                                   |
| MCP                      | `mcp/`                            | Tool registry, `commandTool` helper, bridge to the native server.                                                                                                                         |
| Errors                   | `errors/`                         | `Result`, `CommandFailure`, scoped logger, panel `ErrorBoundary`.                                                                                                                         |
| React                    | `react/`                          | `KernelProvider`, `useKernel`, `useModule(ref)`, `usePoint(point)`, `useHistory`.                                                                                                         |
| Time, ids, notifications | `time/`, `ids/`, `notifications/` | `Micros` helpers, readable ids, toasts.                                                                                                                                                   |

Built-in `history` module (`historyRef`, core): commands `history.undo`, `history.redo`; MCP tools `history_undo`, `history_redo`, `history_list`; keybindings Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y.
