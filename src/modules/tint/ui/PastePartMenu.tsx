import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, Popover, Switch } from "@/ui";

const PARTS = [
  "Basics",
  "Wheels",
  "Curves",
  "Color mix",
  "Creative",
  "Limit",
  "LUT and color",
] as const;

/** Paste only some tools of the copied grade onto the selected clips. */
export function PastePartMenu() {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set(["Basics", "Wheels"]));
  const flip = (part: string) => {
    const next = new Set(chosen);
    if (!next.delete(part)) next.add(part);
    setChosen(next);
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <IconButton label="Paste part of a grade: only the balance, only the wheels, only the LUT…">
          <ClipboardList />
        </IconButton>
      }
    >
      <div className="flex w-56 flex-col gap-1.5 p-2">
        <span className="px-1 font-mono text-2xs font-bold tracking-wide text-subtle-foreground uppercase">
          Paste only
        </span>
        {PARTS.map((part) => (
          <label key={part} className="flex items-center justify-between gap-2 px-1 text-base">
            {part}
            <Switch label={part} checked={chosen.has(part)} onChange={() => flip(part)} />
          </label>
        ))}
        <Button size="sm" variant="primary" className="mt-1" onClick={() => setOpen(false)}>
          Paste onto selected clips
        </Button>
      </div>
    </Popover>
  );
}
