import type { MenuItem } from "@/ui";
import type { ClipMenuEntry, ClipMenuGroup } from "../timeline.types";

const GROUPS: readonly ClipMenuGroup[] = [
  "clipboard",
  "timing",
  "edit",
  "reset",
  "composition",
  "library",
  "delete",
];

const rank = ({ group, order = 0 }: ClipMenuEntry) => GROUPS.indexOf(group) * 1000 + order;

/** A clip's menu entries from any module, in the menu's order. */
export function arrangeMenu(entries: readonly ClipMenuEntry[]): MenuItem[] {
  return [...entries].sort((a, b) => rank(a) - rank(b));
}
