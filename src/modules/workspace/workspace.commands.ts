import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { createEmptyProject, projectRef } from "@/modules/project";
import { isValidName } from "./logic/names";
import { workspaceRef } from "./workspace.ref";

const description = z.string().max(2000);

/** Starts an empty project. The open one is saved first. */
export const newProject = defineCommand({
  id: "workspace.new",
  label: "New project",
  description:
    "Saves the open project and starts an empty one. Optional: name and description (what the project is about, for whoever opens it later); with either, its file is created right away. It can't be undone, and the undo history is cleared; the previous project stays in workspace_list_recent. Fails with workspace.bad_name. Follow with composition_create.",
  undoable: false,
  input: z.object({ name: z.string().optional(), description: description.optional() }),
  async run(ctx, input) {
    const workspace = ctx.require(workspaceRef);
    const { store, view } = ctx.require(projectRef);
    const name = input.name?.trim() || undefined;
    if (name !== undefined && !isValidName(name)) {
      throw new CommandFailure("workspace.bad_name", "A name can't use / \\ : * ? \" < > |");
    }
    await workspace.leave();
    const about = input.description?.trim();
    const document = { ...createEmptyProject(), ...(about ? { description: about } : {}) };
    ctx.replace(store, document);
    view.reset();
    workspace.opened(null, document, [], name);
    workspace.announce(ctx.actor, "started a new project.");
    // What the user gave it is worth a file now. If this fails they're told, and autosave retries.
    if (name !== undefined || about) await workspace.save().catch(() => undefined);
  },
});

/** Opens a project file. The open one is saved first. */
export const openProject = defineCommand({
  id: "workspace.open",
  label: "Open project",
  description:
    "Saves the open project and opens the .cclip file at an absolute path. It can't be undone, and the undo history is cleared; the previous project stays in workspace_list_recent. Returns { name, missing }: media whose file wasn't found (fix with media_relink). Fails with workspace.not_found, workspace.not_a_project, workspace.too_new, workspace.damaged or store.invalid, leaving the open project as it was.",
  undoable: false,
  input: z.object({ path: z.string().min(1) }),
  async run(ctx, { path }) {
    const workspace = ctx.require(workspaceRef);
    const { store, view } = ctx.require(projectRef);
    await workspace.leave();
    const { document, missing } = await workspace.prepare(path);
    ctx.replace(store, document);
    view.reset();
    workspace.opened(path, document, missing);
    const { name } = workspace.session.getState();
    workspace.announce(ctx.actor, `opened ${name}.`);
    return { name, missing: missing.map(({ id, name, path }) => ({ id, name, path })) };
  },
});

/** Says what the project is about. It's part of the document, so it can be undone. */
export const setDescription = defineCommand({
  id: "workspace.setDescription",
  label: "Edit description",
  description:
    "Sets what the project is about, for the people and agents who open it later. An empty text removes it.",
  undoable: true,
  input: z.object({ description }),
  run(ctx, input) {
    const about = input.description.trim();
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      if (about) draft.description = about;
      else delete draft.description;
    });
  },
});

/** Saves now. Autosave does this on its own, so it's for being sure. */
export const saveProject = defineCommand({
  id: "workspace.save",
  label: "Save",
  description:
    "Writes the project to its file now, creating it in the projects folder when it has none. Changes are also saved on their own a moment after each edit. Returns { path, name, status }.",
  undoable: false,
  input: z.object({}),
  run: (ctx) => ctx.require(workspaceRef).save(),
});

/** Saves to another file, which becomes the open project. */
export const saveProjectAs = defineCommand({
  id: "workspace.saveAs",
  label: "Save as",
  description:
    "Writes the project to an absolute path, which becomes its file: later saves go there. The old file stays. Returns { path, name, status }.",
  undoable: false,
  input: z.object({ path: z.string().min(1) }),
  run: (ctx, { path }) => ctx.require(workspaceRef).saveAs(path),
});

/** Renames the project and its file. */
export const renameProject = defineCommand({
  id: "workspace.rename",
  label: "Rename project",
  description:
    "Renames the project, and its file when it has one. Fails with workspace.bad_name or workspace.name_taken. Returns { path, name, status }.",
  undoable: false,
  input: z.object({ name: z.string() }),
  run: (ctx, { name }) => ctx.require(workspaceRef).rename(name),
});

/** Lists the projects opened here, latest first. */
export const listRecent = defineCommand({
  id: "workspace.listRecent",
  label: "List recent projects",
  description:
    "Lists the projects opened here, latest first: path, name, description (what it's about, when given), lastUsed (ms since the epoch), width, height and duration (microseconds) of Main.",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    const { items } = ctx.require(workspaceRef).recents.store.getState();
    return items.map(({ thumbnail: _, ...project }) => project);
  },
});

/** Shows the start dialog. */
export const showStart = defineCommand({
  id: "workspace.showStart",
  label: "Home",
  description: "Shows the start dialog: recent projects and new ones.",
  undoable: false,
  input: z.object({}),
  run: (ctx) => ctx.require(workspaceRef).ui.setState({ start: "home" }),
});

/** Asks the user for a file to open. A picker needs a person, so agents have no tool for it. */
export const askOpen = defineCommand({
  id: "workspace.askOpen",
  label: "Open…",
  description: "Asks the user which project file to open.",
  undoable: false,
  input: z.object({}),
  run: (ctx) => ctx.require(workspaceRef).askOpen(),
});

/** Asks the user where to save. A picker needs a person, so agents have no tool for it. */
export const askSaveAs = defineCommand({
  id: "workspace.askSaveAs",
  label: "Save as…",
  description: "Asks the user where to save the project.",
  undoable: false,
  input: z.object({}),
  run: (ctx) => ctx.require(workspaceRef).askSaveAs(),
});

export const workspaceCommands = [
  newProject,
  openProject,
  saveProject,
  saveProjectAs,
  renameProject,
  setDescription,
  listRecent,
  showStart,
  askOpen,
  askSaveAs,
];
