import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { useKernel } from "@/core";
import { Button, IconButton, Popover, Switch } from "@/ui";
import { pasteGrade } from "../tint.clipboard.commands";
import type { ToolId } from "../tint.types";
import { settle } from "./settle";

const PARTS: { label: string; tools: ToolId[] }[] = [
  { label: "Basics", tools: ["basics"] },
  { label: "Wheels", tools: ["wheels"] },
  { label: "Curves", tools: ["curves"] },
  { label: "Color mix", tools: ["cmix"] },
  { label: "Creative", tools: ["creative"] },
  { label: "Limit", tools: ["limit"] },
  { label: "LUT and color", tools: ["luts"] },
];

/** Paste only some tools of the copied grade onto the given clips. */
export function PastePartMenu({ clipIds }: { clipIds: string[] }) {
  const { bus } = useKernel();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set(["Basics", "Wheels"]));
  const flip = (part: string) => {
    const next = new Set(chosen);
    if (!next.delete(part)) next.add(part);
    setChosen(next);
  };
  const tools = PARTS.filter((part) => chosen.has(part.label)).flatMap((part) => part.tools);
  const paste = () => {
    setOpen(false);
    void settle(bus.run(pasteGrade, { clipIds, tools }));
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <IconButton
          label="Paste part of a grade: only the balance, only the wheels, only the LUT…"
          disabled={clipIds.length === 0}
        >
          <ClipboardList />
        </IconButton>
      }
    >
      <div className="flex w-56 flex-col gap-1.5 p-2">
        <span className="px-1 font-mono text-2xs font-bold tracking-wide text-subtle-foreground uppercase">
          Paste only
        </span>
        {PARTS.map(({ label }) => (
          <label key={label} className="flex items-center justify-between gap-2 px-1 text-base">
            {label}
            <Switch label={label} checked={chosen.has(label)} onChange={() => flip(label)} />
          </label>
        ))}
        <Button
          size="sm"
          variant="primary"
          className="mt-1"
          disabled={tools.length === 0}
          onClick={paste}
        >
          Paste onto selected clips
        </Button>
      </div>
    </Popover>
  );
}
