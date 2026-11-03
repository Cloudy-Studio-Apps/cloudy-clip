# workspace

Which project is open and where it lives: the start dialog, saving and autosave, opening, renaming, the recent list. The document itself lives in `project`.

- **Tier:** core
- **Requires:** `project`, `media`, `preview`, `composition`
- **Contributes:** `appOverlays` (`StartDialogHost`, `RelinkHost`), `topBarItems` (`ProjectTitle`, left), keybindings `workspace.save` (Ctrl/Cmd+S), `workspace.save-as` (Ctrl/Cmd+Shift+S), `workspace.open` (Ctrl/Cmd+O), `workspace.home` (Ctrl/Cmd+N)
- **Points it owns:** —
- **API** (`WorkspaceApi`): `session` (`path`, `name`, `status`: `blank`, `saved`, `saving`, `failed`), `ui` (start dialog, relink dialog), `recents`, `leave`, `save`, `saveAs`, `rename`, `prepare`, `opened`, `announce`, `folder`, `askOpen`, `askSaveAs`.
- **Files:**
  - `logic/format.ts`: the `.cclip` file, JSON: `{ format, version, appVersion, savedAt, document }`. `decodeProject` checks the shape; the document's rules are checked by `ctx.replace`. A version bump goes here with its upgrade. Version 3 adds `Clip.animation` and `Clip.animationOrigin` (kept as they are: the loose clip schema passes them, and an older file simply has none). A project is saved as version 3 only when a clip has keys, else as version 2, so a project that never used keys still opens in an older app; both open here. Decoding drops key tracks with no keys.
  - `logic/names.ts`: `isBlank`, `isEmpty`, paths and names. `logic/labels.ts`: `ratioLabel`, `agoLabel`.
  - `workspace.session.ts`: the logic of the API above. `workspace.autosave.ts`: writes 2 s after the last change, 30 s at most during a burst, one at a time. `workspace.recents.ts`: the list, in `recent.json` in the app data folder. `workspace.thumbnail.ts`: shrinks a captured frame.
  - `workspace.ask.ts`: the file pickers. They run outside the bus, which would otherwise wait for a person.
  - `workspace.service.ts`: the native calls. Native side: `src-tauri/src/workspace`: reads and writes project files only (absolute paths ending in `.cclip`), atomically.
  - `ui/`: `StartDialogHost`, `NewProjectColumn`, `RecentColumn`, `RecentRow`, `AllProjects`, `ProjectTitle`, `DescriptionField`, `RelinkHost`.
- **Invariants:**
  - The project's name is its file name, so a rename isn't in the document or in undo. Its description is in the document (`ProjectState.description`), so it autosaves, undoes and reaches agents through `project_get_state`, `workspace_get` and `workspace_list_recent`.
  - A project given a name or a description at the start gets its file right away.
  - The file holds the document only. History, selection, playheads, probes and tabs aren't saved; Main opens first.
  - Media stays where it is: the file keeps paths. On open, a file not found at its path is looked for by name next to the project, then marked `missing`.
  - A project with no media, no clips and no description isn't autosaved, so one opened and abandoned leaves no file.
  - Before another project opens, and on window close, pending changes are written. If that fails, opening is refused with `workspace.save_failed`, and closing asks for a second try.
  - A project with no clips opens on Media, any other on Edit. Only the local actor moves the page: an agent's `workspace_open` leaves the user where they are.
  - The start dialog closes when an empty project gets content, so an agent's work isn't hidden behind it.
  - New, open, save, save as and rename can't be undone but do change the project, so their tools set `writes`: an agent on view only is refused.
- **Not yet:** opening a file from the OS, several windows, deleting project files.

| Command                    | MCP tool                    | Notes                                                                               |
| -------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| `workspace.new`            | `workspace_new`             | Saves first, then an empty document. Clears history. Optional `name`, `description` |
| `workspace.open`           | `workspace_open`            | Saves first. Clears history. Returns the `missing` files                            |
| `workspace.save`           | `workspace_save`            | Writes now, even a blank project                                                    |
| `workspace.saveAs`         | `workspace_save_as`         | Autosave follows the new file                                                       |
| `workspace.rename`         | `workspace_rename`          | Renames the file. `workspace.name_taken`, `bad_name`                                |
| `workspace.setDescription` | `workspace_set_description` | Undoable. Empty text removes it                                                     |
| `workspace.listRecent`     | `workspace_list_recent`     |                                                                                     |
| —                          | `workspace_get`             | Path, name, status                                                                  |
| `workspace.showStart`      | —                           | The start dialog                                                                    |
| `workspace.askOpen`        | —                           | The file picker: a person's                                                         |
| `workspace.askSaveAs`      | —                           | The file picker: a person's                                                         |
