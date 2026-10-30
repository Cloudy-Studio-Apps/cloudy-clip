import { definePoint } from "../module/points";
import type { Keybinding, KeyPress, LayoutPanel, TopBarItem } from "./shell.types";

/** Panels of the editor layout. The app shell places them by slot. */
export const layoutPanels = definePoint<LayoutPanel>("shell.layoutPanels", {
  keyOf: (panel) => panel.id,
});

/** Pieces of the top bar. The app shell places them by slot. */
export const topBarItems = definePoint<TopBarItem>("shell.topBarItems", {
  keyOf: (item) => item.id,
});

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
