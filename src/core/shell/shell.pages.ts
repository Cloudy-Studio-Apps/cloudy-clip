import { z } from "zod";
import { createStore } from "zustand/vanilla";
import { defineCommand } from "../command/command.define";
import { defineModule, defineModuleRef } from "../module/module.define";
import type { PagesApi, PagesState } from "./shell.types";

/** The editor, which is always there: it isn't an `AppPage`. */
export const EDITOR_PAGE = "editor";

/** Handle of the built-in pages module. */
export const pagesRef = defineModuleRef<PagesApi>("pages");

/** Shows a page. */
export const showPage = defineCommand({
  id: "pages.show",
  label: "Show page",
  description: "Shows a page beside the editor, or the editor itself (`editor`).",
  undoable: false,
  input: z.object({ page: z.string() }),
  run(ctx, { page }) {
    ctx.require(pagesRef).store.setState({ active: page });
  },
});

/** The built-in `pages` module: which page shows. */
export const pagesModule = defineModule({
  ref: pagesRef,
  name: "Pages",
  tier: "core",
  commands: [showPage],
  setup() {
    return { api: { store: createStore<PagesState>()(() => ({ active: EDITOR_PAGE })) } };
  },
});
