import { Folder, Key, Layers, LayoutGrid, Plus, RotateCcw, Rows3 } from "lucide-react";
import type { MenuItem } from "@/ui";

const nothing = () => {};

/** The node view's right-click menu. Its entries do nothing yet. */
export const NODE_MENU: readonly MenuItem[] = [
  { label: "Correction", icon: Plus, shortcut: "Alt S", onSelect: nothing, group: "add" },
  { label: "Side by side", icon: Folder, shortcut: "Alt P", onSelect: nothing, group: "add" },
  { label: "Stacked", icon: Layers, shortcut: "Alt L", onSelect: nothing, group: "add" },
  { label: "Shared key", icon: Key, onSelect: nothing, group: "add" },
  { label: "Per channel", icon: Rows3, onSelect: nothing, group: "add" },
  { label: "Reset grade", icon: RotateCcw, onSelect: nothing, group: "graph" },
  { label: "Tidy up", icon: LayoutGrid, onSelect: nothing, group: "graph" },
];
