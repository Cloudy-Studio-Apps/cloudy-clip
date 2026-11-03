import {
  groupPages,
  type AppMenuItem,
  type AppPage,
  type AppPageGroup,
  type Keybinding,
  type KeybindingAction,
} from "@/core";
import type { MenuItem } from "@/ui";

/** Submenus in the order they show. One a module adds that isn't here follows them. */
const MENU_ORDER = ["File", "Edit", "Composition", "Tracks", "Playback"];

const KEY_NAMES: Record<string, string> = { " ": "Space", delete: "Del", home: "Home" };

/** How a keybinding reads: `Ctrl+Shift+S`. */
function shortcutOf({ key, mod, shift }: Keybinding): string {
  const parts = [mod && "Ctrl", shift && "Shift", KEY_NAMES[key] ?? key.toUpperCase()];
  return parts.filter(Boolean).join("+");
}

interface AppMenuSource {
  items: readonly AppMenuItem[];
  bindings: readonly Keybinding[];
  pages: readonly AppPage[];
  groups: readonly AppPageGroup[];
  /** Runs what a keybinding resolved to. */
  execute(action: KeybindingAction): void;
  showPage(id: string): void;
}

function entryOf(item: AppMenuItem, source: AppMenuSource): MenuItem {
  const binding = source.bindings.find(({ id }) => id === item.keybinding);
  const action = item.run ? null : binding?.resolve();
  const entry: MenuItem = {
    label: item.label,
    disabled: item.enabled?.() === false || (!item.run && !item.items && !action),
    ...(binding && { shortcut: shortcutOf(binding) }),
  };
  if (item.items) {
    const items = item.items();
    return { ...entry, disabled: items.length === 0, items };
  }
  return { ...entry, onSelect: item.run ?? (() => action && source.execute(action)) };
}

/** The logo's menu: what modules contribute by submenu, a way to each page, then entries of its own. */
export function buildAppMenu(source: AppMenuSource): MenuItem[] {
  const byOrder = (a: AppMenuItem, b: AppMenuItem) => (a.order ?? 0) - (b.order ?? 0);
  const named = source.items.flatMap(({ menu }) => (menu === undefined ? [] : [menu]));
  const names = [...new Set([...MENU_ORDER, ...named])];
  const menus = names.flatMap((name): MenuItem[] => {
    const here = source.items.filter(({ menu }) => menu === name).sort(byOrder);
    if (here.length === 0) return [];
    return [{ label: name, group: "menus", items: here.map((item) => entryOf(item, source)) }];
  });
  const pages = groupPages(source.pages, source.groups)
    .flat()
    .map(({ id, label }) => ({ label, onSelect: () => source.showPage(id) }));
  const own = source.items
    .filter(({ menu }) => menu === undefined)
    .sort(byOrder)
    .map((item) => ({ ...entryOf(item, source), group: "app" }));
  return [...menus, { label: "Go to", group: "menus", items: pages }, ...own];
}
