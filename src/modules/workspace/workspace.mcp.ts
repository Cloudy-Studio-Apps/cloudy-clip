import { z } from "zod";
import { commandTool, defineMcpTool, textResult } from "@/core";
import { projectRef } from "@/modules/project";
import {
  listRecent,
  newProject,
  openProject,
  renameProject,
  saveProject,
  saveProjectAs,
  setDescription,
} from "./workspace.commands";
import { workspaceRef } from "./workspace.ref";

/** Says which project is open. */
const get = defineMcpTool({
  name: "workspace_get",
  readOnly: true,
  description:
    "Says which project is open: path (null until it's first saved), name, description (what it's about, when given), and status (blank, saved, saving, failed).",
  input: z.object({}),
  handler(_input, ctx) {
    const { description } = ctx.require(projectRef).store.getState();
    return textResult({ ...ctx.require(workspaceRef).session.getState(), description });
  },
});

export const workspaceMcpTools = [
  get,
  commandTool(newProject, { name: "workspace_new", writes: true }),
  commandTool(openProject, { name: "workspace_open", writes: true }),
  commandTool(saveProject, { name: "workspace_save", writes: true }),
  commandTool(saveProjectAs, { name: "workspace_save_as", writes: true }),
  commandTool(renameProject, { name: "workspace_rename", writes: true }),
  commandTool(setDescription, { name: "workspace_set_description" }),
  commandTool(listRecent, { name: "workspace_list_recent" }),
];
