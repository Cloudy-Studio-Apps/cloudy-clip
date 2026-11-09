import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, MenuList, Popover, type MenuItem } from "@/ui";

/** + Add: a correction above the selected layer (else at the bottom). Groups and looks join the menu as they can be made. */
export function AddMenu({ onCorrection }: { onCorrection(): void }) {
  const items: readonly MenuItem[] = [{ label: "Correction", icon: Plus, onSelect: onCorrection }];
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
      <MenuList items={items} onClose={() => setOpen(false)} />
    </Popover>
  );
}
