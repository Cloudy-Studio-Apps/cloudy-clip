import { z } from "zod";
import { defineCommand } from "@/core";
import { tintRef } from "./tint.ref";

/** The clean viewer: only the picture, full screen. */
export const setClean = defineCommand({
  id: "tint.setClean",
  label: "Clean viewer",
  description:
    "Fills the window with the Tint page's viewer (on), or goes back (off); no input flips it. The user's view only: not saved, no MCP tool.",
  undoable: false,
  input: z.object({ on: z.boolean().optional() }),
  run(ctx, { on }) {
    const { view } = ctx.require(tintRef);
    view.setState({ clean: on ?? !view.getState().clean });
  },
});
