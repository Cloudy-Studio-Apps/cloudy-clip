import {
  Contrast,
  Eye,
  EyeOff,
  MoreVertical,
  MoveDown,
  MoveUp,
  Spline,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { MARKER_HEX } from "@/modules/marker";
import type { ClipMask } from "@/modules/project";
import { IconButton, MenuList, Popover, SelectField, cn } from "@/ui";
import type { useMaskEdit } from "./mask.edit.hook";

const MODES = [
  { value: "add", label: "Add" },
  { value: "subtract", label: "Subtract" },
  { value: "intersect", label: "Intersect" },
  { value: "difference", label: "Difference" },
];

interface MaskRowProps {
  clipId: string;
  mask: ClipMask;
  index: number;
  count: number;
  selected: boolean;
  edit: ReturnType<typeof useMaskEdit>;
  onSelect(): void;
}

/** One mask of the list: color, name (double-click renames), mode, invert, on, and a menu. */
export function MaskRow({ clipId, mask, index, count, selected, edit, onSelect }: MaskRowProps) {
  const [name, setName] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const patch = (changes: Record<string, unknown>) =>
    void edit.run("mask.update", { clipId, maskId: mask.id, patch: changes });
  const on = mask.on !== false;
  const commitName = () => {
    const next = name?.trim();
    if (next && next !== mask.name) patch({ name: next });
    setName(null);
  };
  const preset = mask.shape.kind !== "path";
  const items = [
    ...(preset
      ? [
          {
            label: "Convert to points",
            icon: Spline,
            disabled: mask.shape.kind === "linear" || mask.shape.kind === "mirror",
            onSelect: () => void edit.run("mask.convert", { clipId, maskId: mask.id }),
          },
        ]
      : []),
    {
      label: "Move up",
      icon: MoveUp,
      disabled: index === 0,
      onSelect: () => void edit.run("mask.reorder", { clipId, maskId: mask.id, index: index - 1 }),
    },
    {
      label: "Move down",
      icon: MoveDown,
      disabled: index === count - 1,
      onSelect: () => void edit.run("mask.reorder", { clipId, maskId: mask.id, index: index + 1 }),
    },
    {
      label: "Delete",
      icon: Trash2,
      destructive: true,
      onSelect: () => void edit.run("mask.remove", { clipId, maskIds: [mask.id] }),
    },
  ];

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex min-w-0 cursor-pointer items-center gap-1.5 rounded-xs px-1 py-0.5",
        selected ? "bg-muted" : "hover:bg-muted/50",
        !on && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: MARKER_HEX[mask.color] }}
      />
      {name === null ? (
        <span
          className="min-w-0 flex-1 truncate text-base"
          onDoubleClick={() => setName(mask.name)}
        >
          {mask.name}
        </span>
      ) : (
        <input
          autoFocus
          aria-label="Mask name"
          value={name}
          className="min-w-0 flex-1 border-b border-ring bg-transparent text-base outline-none"
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            else if (event.key === "Escape") {
              event.stopPropagation();
              setName(null);
            }
          }}
        />
      )}
      <SelectField
        label="Mask mode"
        value={mask.mode}
        options={MODES}
        className="w-[88px]"
        onChange={(mode) => patch({ mode })}
      />
      <IconButton
        label="Invert mask"
        active={mask.invert === true}
        className="!size-[22px]"
        onClick={(event) => {
          event.stopPropagation();
          patch({ invert: mask.invert !== true });
        }}
      >
        <Contrast />
      </IconButton>
      <IconButton
        label={on ? "Turn mask off" : "Turn mask on"}
        className="!size-[22px]"
        onClick={(event) => {
          event.stopPropagation();
          patch({ on: !on });
        }}
      >
        {on ? <Eye /> : <EyeOff />}
      </IconButton>
      <Popover
        open={menu}
        onOpenChange={setMenu}
        trigger={
          <IconButton label="Mask menu" className="!size-[22px]">
            <MoreVertical />
          </IconButton>
        }
      >
        <MenuList items={items} onClose={() => setMenu(false)} />
      </Popover>
    </div>
  );
}
