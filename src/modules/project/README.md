# project

Owns the **project document**: format, media, tracks, clips (`ProjectState` in `project.types.ts`). It is a patchable store (`projectStore`), so every change is undoable and readable by agents. Other modules read it through selectors and change it through their own commands.

- Track order is top → bottom; higher video tracks are drawn on top.
- `Track.clipIds` is always sorted by `start`, and clips on a track never overlap.
- Times are microseconds.

| Command             | MCP tool             |                                          |
| ------------------- | -------------------- | ---------------------------------------- |
| `project.setFormat` | `project_set_format` | `9:16`, `16:9`, `1:1`                    |
| —                   | `project_get_state`  | Whole document, tracks with clips inline |
