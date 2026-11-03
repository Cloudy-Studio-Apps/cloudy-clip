import { ChevronDown, GitBranch } from "lucide-react";
import { useState } from "react";
import { MenuList, Popover, type MenuItem } from "@/ui";

const nothing = () => {};

const ITEMS: readonly MenuItem[] = [
  { label: "A (showing)", onSelect: nothing, group: "versions" },
  { label: "B", onSelect: nothing, group: "versions" },
  { label: "New version", onSelect: nothing, group: "edit" },
  { label: "Rename…", onSelect: nothing, group: "edit" },
  { label: "Delete this version", onSelect: nothing, group: "edit", destructive: true },
];

/** Versions of the clip's grade: flip between them, add, rename, delete. */
export function VersionMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          title="Versions: keep several grades on a clip and flip between them"
          className="ml-1.5 inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm bg-background px-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <GitBranch className="size-3.5" />A
          <ChevronDown className="size-3" />
        </button>
      }
    >
      <MenuList items={ITEMS} onClose={() => setOpen(false)} />
    </Popover>
  );
}
