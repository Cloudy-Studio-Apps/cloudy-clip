# workspace

Which project is open and where it lives: the start dialog, saving and autosave, opening, renaming, the recent list. The document itself lives in `project`.

- **Tier:** core
- **Requires:** `project`, `media`, `preview`, `composition`
- **Contributes:** `appOverlays` (`StartDialogHost`, `RelinkHost`), `relinkKinds` (`workspace.media`: `MediaRelinkRows`), `topBarItems` (`ProjectTitle`, left), keybindings `workspace.save` (Ctrl/Cmd+S), `workspace.save-as` (Ctrl/Cmd+Shift+S), `workspace.open` (Ctrl/Cmd+O), `workspace.home` (Ctrl/Cmd+N)
- **Points it owns:** `relinkKinds` (`workspace.points.ts`, `RelinkKind { id, order, component }`): the kinds of file a project keeps by path, read by `RelinkHost`. A kind may give a `note`, shown while it has missing files (media's: files in the same folder are found together). Each `component` draws its missing files, each a `RelinkRow` (exported: name, path as tooltip, optional tag, Locate…), and reports how many there are (`RelinkRowsProps.onCount`); the dialog closes once every kind has reported none. Media is the workspace's own (`MediaRelinkRows`, `useLocateMedia`); `tint` adds LUT files and opens the dialog (`ui.relink`) when one can't be read.
- **API** (`WorkspaceApi`): `session` (`path`, `name`, `status`: `blank`, `saved`, `saving`, `failed`), `ui` (start dialog, relink dialog), `recents`, `leave`, `prepareLeave`, `beforeLeave(task)`, `save`, `saveAs`, `rename`, `prepare`, `opened`, `announce`, `folder`, `askOpen`, `askSaveAs`.
- **Files:**
  - `logic/format.ts`: the `.cclip` file, JSON: `{ format, version, appVersion, savedAt, document }`. `decodeProject` checks the shape; the document's rules are checked by `ctx.replace`. A version bump goes here with its upgrade. Version 3 adds `Clip.animation` and `Clip.animationOrigin` (kept as they are: the loose clip schema passes them, and an older file simply has none). Version 4 adds the grade data (`Clip.grade`, `gradeVersions`, `gradeVersion`, `gradeGroup`, `Composition.grade`, `gradeGroups`, `luts`, `stills`, `stillOrder`), also passed by the loose schemas. Version 5 adds motion paths (`paths`, checked: two or more points of numbers) and `Clip.follow`. A project is saved as version 5 only when it has paths or a follower (`usesPaths`), else as version 4 when it uses grades (`usesGrades`), else as version 3 when a clip has keys, else as version 2, so a project that never used them still opens in an older app; all open here. Decoding drops key tracks with no keys, and checks every grade (clips, versions, shot groups, compositions and stills) with `gradeSchema` and `validateGrade`: a broken one is dropped with a logged warning, never refusing the file. A clip following a missing path, or one of another composition, stops following (its `follow.*` tracks go too), also with a warning.
  - `logic/names.ts`: `isBlank`, `isEmpty`, paths and names. `logic/labels.ts`: `ratioLabel`, `agoLabel`.
  - `workspace.session.ts`: the logic of the API above. `workspace.autosave.ts`: writes 2 s after the last change, 30 s at most during a burst, one at a time. `workspace.recents.ts`: the list, in `recent.json` in the app data folder. The recent list's thumbnail is a capture shrunk with `@/ui`'s `shrinkDataUrl`.
  - `workspace.ask.ts`: the file pickers. They run outside the bus, which would otherwise wait for a person.
  - `workspace.service.ts`: the native calls. Native side: `src-tauri/src/workspace`: reads and writes project files only (absolute paths ending in `.cclip`), atomically. Its `file_path(raw, extension)` (absolute, that extension in any case) is the path check other modules' native commands share (`tint_read_lut`); project paths go through it too, so `.cclip` is now accepted in any case (`.CCLIP`).
  - `ui/`: `StartDialogHost`, `NewProjectColumn`, `RecentColumn`, `RecentRow`, `AllProjects`, `ProjectTitle`, `DescriptionField`, `RelinkHost` (the dialog, every kind of `relinkKinds`), `MediaRelinkRows`, `RelinkRow`.
- **Invariants:**
  - The project's name is its file name, so a rename isn't in the document or in undo. Its description is in the document (`ProjectState.description`), so it autosaves, undoes and reaches agents through `project_get_state`, `workspace_get` and `workspace_list_recent`.
  - A project given a name or a description at the start gets its file right away.
  - The file holds the document only. History, selection, playheads, probes and tabs aren't saved; Main opens first.
  - Media stays where it is: the file keeps paths. On open, a file not found at its path is looked for by name next to the project, then marked `missing`. LUT files (`tint`) are kept by path too; one that can't be read is listed in the same dialog.
  - A project with no media, no clips and no description isn't autosaved, so one opened and abandoned leaves no file.
  - Work another module must land in this project before it's left (`sound`: a recording stopped and placed) is a `LeaveTask` added with `beforeLeave`: `finish()` and `blocking()`. `prepareLeave()` finishes every task outside the bus, as top-level commands of their own (undoable, never inside a command that can't be undone); the start dialog (`NewProjectColumn`, `RecentRow`), the Open picker, Open recent and window close await it before `workspace.new` / `workspace.open`. Inside those commands, `leave()` refuses with a task's `blocking()` failure (`workspace.recording` while a take is under way), so an agent's `workspace_open` never strands the work. A task that throws is logged and the rest go on. Then pending changes are written. If that fails, opening is refused with `workspace.save_failed`, and closing asks for a second try.
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
