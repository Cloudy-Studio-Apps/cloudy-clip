import { Scissors } from "lucide-react";
import { z } from "zod";
import { createStore } from "zustand/vanilla";
import { defineCommand } from "../command/command.define";
import { defineModule, defineModuleRef } from "../module/module.define";
import { appPageGroups, appPages, PAGE_GROUP_CREATE, PAGE_GROUP_DELIVER } from "./shell.points";
import type { PagesApi, PagesState } from "./shell.types";

/** The editor's page. It has no component: the editor is always mounted, under the other pages. */
export const EDITOR_PAGE = "editor";

/** Handle of the built-in pages module. */
export const pagesRef = defineModuleRef<PagesApi>("pages");

/** Shows a page. */
export const showPage = defineCommand({
  id: "pages.show",
  label: "Show page",
  description: "Shows a page of the app, or the editor itself (`editor`).",
  undoable: false,
  input: z.object({ page: z.string() }),
  run(ctx, { page }) {
    ctx.require(pagesRef).store.setState({ active: page });
  },
});

/** The built-in `pages` module: which page shows, the tab groups and the editor's tab. */
export const pagesModule = defineModule({
  ref: pagesRef,
  name: "Pages",
  tier: "core",
  commands: [showPage],
  setup({ contribute }) {
    contribute(
      appPageGroups,
      { id: PAGE_GROUP_CREATE, order: 10 },
      { id: PAGE_GROUP_DELIVER, order: 20 },
    );
    contribute(appPages, { id: EDITOR_PAGE, label: "Edit", icon: Scissors, order: 20 });
    return { api: { store: createStore<PagesState>()(() => ({ active: EDITOR_PAGE })) } };
  },
});
