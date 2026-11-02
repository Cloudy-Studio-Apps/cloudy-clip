import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { themeRef } from "./theme.ref";

/** Changes the user's theme choice. It isn't part of the project, so it can't be undone. */
export const setTheme = defineCommand({
  id: "theme.set",
  label: "Set theme",
  description:
    "Changes the theme choice: mode (fixed or system), themeId (shown when fixed), lightThemeId and darkThemeId (shown when system), density (null follows the theme). Fails with theme.unknown for a theme that doesn't exist.",
  undoable: false,
  input: z.object({
    mode: z.enum(["fixed", "system"]).optional(),
    themeId: z.string().optional(),
    lightThemeId: z.string().optional(),
    darkThemeId: z.string().optional(),
    density: z.enum(["compact", "default", "comfortable"]).nullable().optional(),
  }),
  run(ctx, input) {
    const { store, list } = ctx.require(themeRef);
    const known = new Set(list().map(({ id }) => id));
    for (const id of [input.themeId, input.lightThemeId, input.darkThemeId]) {
      if (id !== undefined && !known.has(id)) {
        throw new CommandFailure("theme.unknown", `There is no theme "${id}"`);
      }
    }
    const changes = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );
    store.setState(changes);
  },
});

/** The commands of the theme module. */
export const themeCommands = [setTheme];
