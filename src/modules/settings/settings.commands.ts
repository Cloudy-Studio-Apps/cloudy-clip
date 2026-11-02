import { z } from "zod";
import { defineCommand } from "@/core";
import { settingsRef } from "./settings.ref";

/** Opens the Settings window. */
export const openSettings = defineCommand({
  id: "settings.open",
  label: "Settings",
  description: "Opens the Settings window on the user's screen.",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    ctx.require(settingsRef).store.setState({ open: true });
  },
});

/** The commands of the settings module. */
export const settingsCommands = [openSettings];
