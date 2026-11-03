import { Blend, Folder, Layers, Plus, Rows3 } from "lucide-react";
import { useState } from "react";
import { Button, MenuList, Popover, type MenuItem } from "@/ui";

const nothing = () => {};

const ITEMS: readonly MenuItem[] = [
  { label: "Correction", icon: Plus, shortcut: "Alt S", onSelect: nothing, group: "add" },
  {
    label: "Group, side by side",
    icon: Folder,
    shortcut: "Alt P",
    onSelect: nothing,
    group: "group",
  },
  { label: "Group, stacked", icon: Layers, shortcut: "Alt L", onSelect: nothing, group: "group" },
  { label: "Group, per channel", icon: Rows3, onSelect: nothing, group: "group" },
  { label: "Look…", icon: Blend, onSelect: nothing, group: "look" },
];

/** + Add: a correction, a group or a look, above the selected layer. */
export function AddMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          variant="primary"
          size="sm"
          title="Add a correction, a group or a look. Top runs first; drag to reorder."
        >
          + Add
        </Button>
      }
    >
      <MenuList items={ITEMS} onClose={() => setOpen(false)} />
    </Popover>
  );
}
