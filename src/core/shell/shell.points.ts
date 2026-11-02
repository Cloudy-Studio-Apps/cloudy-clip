import { definePoint } from "../module/points";
import type {
  AppOverlay,
  AppPage,
  AppPageGroup,
  Keybinding,
  KeyPress,
  LayoutPanel,
  TopBarItem,
} from "./shell.types";

/** Panels of the editor layout. The app shell places them by slot. */
export const layoutPanels = definePoint<LayoutPanel>("shell.layoutPanels", {
  keyOf: (panel) => panel.id,
});

/** Pieces of the top bar. The app shell places them by slot. */
export const topBarItems = definePoint<TopBarItem>("shell.topBarItems", {
  keyOf: (item) => item.id,
});

/** Layers over the whole window that never take the pointer. The app shell draws them. */
export const appOverlays = definePoint<AppOverlay>("shell.appOverlays", {
  keyOf: (overlay) => overlay.id,
});

/** The group of the pages you work on: Media, Edit, Sound. */
export const PAGE_GROUP_CREATE = "create";

/** The group of the pages that take the work out of the app: Export. */
export const PAGE_GROUP_DELIVER = "deliver";

/** The pages of the app, each with a tab. The app shell shows the active one. */
export const appPages = definePoint<AppPage>("shell.appPages", {
  keyOf: (page) => page.id,
});

/** Groups of tabs in the top bar. The app shell orders pages by them. */
export const appPageGroups = definePoint<AppPageGroup>("shell.appPageGroups", {
  keyOf: (group) => group.id,
});

/** Pages as their tabs show: one list per group that has any, each in order. */
export function groupPages(
  pages: readonly AppPage[],
  groups: readonly AppPageGroup[],
): AppPage[][] {
  const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0);
  const groupOf = (page: AppPage) => page.group ?? PAGE_GROUP_CREATE;
  const ids = [...[...groups].sort(byOrder).map(({ id }) => id), ...pages.map(groupOf)];
  return [...new Set(ids)]
    .map((id) => pages.filter((page) => groupOf(page) === id).sort(byOrder))
    .filter((list) => list.length > 0);
}

/** Keyboard shortcuts. The app shell's keybinding host reads them. */
export const keybindings = definePoint<Keybinding>("shell.keybindings", {
  keyOf: (binding) => binding.id,
});

/** The binding a key press triggers, if any. Modifiers must match exactly. */
export function matchKeybinding(
  bindings: readonly Keybinding[],
  press: KeyPress,
): Keybinding | undefined {
  const key = press.key.toLowerCase();
  const mod = press.ctrlKey || press.metaKey;
  return bindings.find(
    (binding) => binding.key === key && !!binding.mod === mod && !!binding.shift === press.shiftKey,
  );
}
