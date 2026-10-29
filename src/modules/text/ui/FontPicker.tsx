import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FontFamily } from "@/modules/fonts";
import type { TextStyle } from "../text.types";
import { Popover } from "@/ui";
import { FontList } from "./FontList";
import { useFontStatus } from "./text.fonts.hook";

interface FontPickerProps {
  style: TextStyle;
  onPick(family: FontFamily): void;
}

/** The family button (with a "Missing" note when its face could not load) and the searchable list it opens. */
export function FontPicker({ style, onPick }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const status = useFontStatus({
    ...style.font,
    weight: style.weight,
    style: style.italic ? "italic" : "normal",
  });
  return (
    <div className="flex flex-col gap-1">
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger={
          <button
            type="button"
            aria-label="Font family"
            className="flex h-7 w-full cursor-pointer items-center justify-between gap-2 rounded-sm border border-border bg-surface-sunken px-2 text-xs text-foreground hover:bg-hover"
          >
            <span className="truncate">{style.font.family}</span>
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          </button>
        }
      >
        <FontList
          current={style.font.family}
          onPick={(family) => {
            setOpen(false);
            onPick(family);
          }}
        />
      </Popover>
      {status === "missing" && (
        <span className="text-2xs text-destructive">Missing — showing Inter</span>
      )}
    </div>
  );
}
