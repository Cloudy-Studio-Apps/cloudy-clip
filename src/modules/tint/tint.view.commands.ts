import { z } from "zod";
import { CommandFailure, defineCommand, LOCAL_ACTOR } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { holdsTime, landingTime } from "./logic/strip";
import { tintRef } from "./tint.ref";
import type { GradeLevel, TintMode, ToolId } from "./tint.types";

const MODES = ["baby", "leader"] as const satisfies readonly TintMode[];
const LEVELS = ["clip", "group", "timeline"] as const satisfies readonly GradeLevel[];
const TOOLS = [
  "basics",
  "wheels",
  "curves",
  "cmix",
  "warper",
  "creative",
  "limit",
  "luts",
  "match",
  "mixer",
] as const satisfies readonly ToolId[];

/** How the Tint page shows the grade: layers or nodes. The same grade either way. */
export const setMode = defineCommand({
  id: "tint.setMode",
  label: "Baby Seal or Leader Seal",
  description:
    "Shows the grade on the Tint page as layers (baby) or as nodes (leader). The grade is the same; this is the user's view only: not saved, no MCP tool.",
  undoable: false,
  input: z.object({ mode: z.enum(MODES) }),
  run(ctx, { mode }) {
    ctx.require(tintRef).view.setState({ mode });
  },
});

/**
 * Makes a clip the one being graded and puts the playhead in it (where it was last, else the
 * middle); it stays until another clip is pinned or the playhead leaves it. `clipId: null` lets go.
 */
export const pinClip = defineCommand({
  id: "tint.pin",
  label: "Grade this clip",
  description:
    "Pins a gradeable clip of the open composition as the one the Tint page grades, and moves the playhead into it (where it was last, else its middle). It stays pinned until another clip is pinned or the playhead leaves it; clipId null lets go. The user's view only: not saved, no MCP tool. Fails with tint.clip_not_found when the clip isn't a gradeable clip of the open composition.",
  undoable: false,
  input: z.object({ clipId: z.string().nullable() }),
  run(ctx, { clipId }) {
    const tint = ctx.require(tintRef);
    const { view } = tint;
    if (clipId === null) {
      view.setState({ pinned: null });
      return;
    }
    const project = ctx.require(projectRef);
    const state = project.store.getState();
    const open = project.view.openFor(LOCAL_ACTOR);
    const clip = state.clips[clipId];
    if (open === null || !clip || !holdsTime(state, open, clipId, clip.start)) {
      throw new CommandFailure(
        "tint.clip_not_found",
        `"${clipId}" is not a gradeable clip of the open composition`,
      );
    }
    ctx.require(previewRef).playback.seek(landingTime(clip, tint.viewedAt(clipId)));
    // After the seek: moving the playhead into the clip must not look like leaving the old pin.
    view.setState({ pinned: clipId });
  },
});

/** Selects the layer or node being edited. */
export const selectNode = defineCommand({
  id: "tint.selectNode",
  label: "Select a layer",
  description:
    "Selects the layer or node the Tint page edits, or none (null). The user's view only: not saved, no MCP tool.",
  undoable: false,
  input: z.object({ nodeId: z.string().nullable() }),
  run(ctx, { nodeId }) {
    ctx.require(tintRef).view.setState({ selected: nodeId });
  },
});

/** Opens a tool in the Tint page's rail. */
export const setTool = defineCommand({
  id: "tint.setTool",
  label: "Open a tool",
  description:
    "Opens a tool of the Tint page (basics, wheels, curves, cmix, warper, creative, limit, luts, match, mixer). The user's view only: not saved, no MCP tool.",
  undoable: false,
  input: z.object({ tool: z.enum(TOOLS) }),
  run(ctx, { tool }) {
    ctx.require(tintRef).view.setState({ tool });
  },
});

/** Chooses which grade the page edits: the clip's, its shot group's, or the whole timeline's. */
export const setLevel = defineCommand({
  id: "tint.setLevel",
  label: "Grade level",
  description:
    "Chooses which grade the Tint page edits: this clip, its shot group, or the whole timeline. The user's view only: not saved, no MCP tool.",
  undoable: false,
  input: z.object({ level: z.enum(LEVELS) }),
  run(ctx, { level }) {
    ctx.require(tintRef).view.setState({ level });
  },
});

/** Shows every clip with no grade (on) or graded (off); no input flips it. */
export const setBypass = defineCommand({
  id: "tint.setBypass",
  label: "Bypass grades",
  description:
    "Draws the live preview with no grade on any clip (on), or graded (off); no input flips it. Captures and exports are never bypassed. The user's view only: not saved, no MCP tool.",
  undoable: false,
  input: z.object({ on: z.boolean().optional() }),
  run(ctx, { on }) {
    const { picture } = ctx.require(previewRef);
    picture.setBypass(on ?? !picture.view.getState().bypass);
  },
});

/** Draws grades again and ends before/after. Run when the user leaves the Tint page, where they show. */
export const clearViewing = defineCommand({
  id: "tint.clearViewing",
  label: "Show grades again",
  description:
    "Turns bypass and before/after off so the live preview draws every grade. The user's view only: not saved, no MCP tool.",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    const { picture } = ctx.require(previewRef);
    if (picture.view.getState().bypass) picture.setBypass(false);
    if (picture.view.getState().compare !== null) picture.setCompare(null);
  },
});

/** The view commands, for the module. */
export const tintViewCommands = [
  setMode,
  pinClip,
  selectNode,
  setTool,
  setLevel,
  setBypass,
  clearViewing,
];
