import { Columns3, Folder, Images, Layers, Plus } from "lucide-react";
import { useState } from "react";
import { Button, MenuList, Popover, type MenuItem } from "@/ui";

type GroupKind = "parallel" | "layer" | "channels";

interface AddMenuProps {
  onCorrection(): void;
  onGroup(kind: GroupKind): void;
  /** Shows the Looks tab, to choose a look to add. */
  onLook(): void;
  /** Which groups can be made around the selected layer. */
  canGroup: Record<GroupKind, boolean>;
}

/**
 * + Add: a correction above the selected layer (else at the bottom), or a group around the
 * selected layer: side by side or stacked with the layer after it, per channel with it alone in
 * the red branch; Look… goes to the Looks tab.
 */
export function AddMenu({ onCorrection, onGroup, onLook, canGroup }: AddMenuProps) {
  const items: readonly MenuItem[] = [
    { label: "Correction", icon: Plus, onSelect: onCorrection },
    {
      label: "Group (side by side)",
      icon: Folder,
      group: "groups",
      disabled: !canGroup.parallel,
      onSelect: () => onGroup("parallel"),
    },
    {
      label: "Group (stacked)",
      icon: Layers,
      group: "groups",
      disabled: !canGroup.layer,
      onSelect: () => onGroup("layer"),
    },
    {
      label: "Per channel",
      icon: Columns3,
      group: "groups",
      disabled: !canGroup.channels,
      onSelect: () => onGroup("channels"),
    },
    { label: "Look…", icon: Images, group: "looks", onSelect: onLook },
  ];
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          variant="primary"
          size="sm"
          title="Add a correction, or group the selected layer: side by side or stacked with the one after it, or per channel. Top runs first; drag to reorder."
        >
          + Add
        </Button>
      }
    >
      <MenuList items={items} onClose={() => setOpen(false)} />
    </Popover>
  );
}
