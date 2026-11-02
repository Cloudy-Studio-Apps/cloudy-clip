import { Settings2 } from "lucide-react";
import { useModule } from "@/core";
import { cn } from "@/ui";
import { exportRef } from "../export.ref";
import { EXPORT_KINDS } from "../logic/presets";
import type { ExportKind } from "../export.types";

interface KindTilesProps {
  value: ExportKind;
  /** The picture on the tiles, as a data URL. */
  picture: string | null;
  /** Estimated size at a quality, as text. */
  sizeAt(quality: number): string;
}

/** The kinds of export, each with how sharp it looks and how big the file gets. */
export function KindTiles({ value, picture, sizeAt }: KindTilesProps) {
  const { form } = useModule(exportRef);
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {EXPORT_KINDS.map(({ id, label, quality }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => form.setState(quality === null ? { kind: id } : { kind: id, quality })}
          className={cn(
            "flex min-w-0 cursor-pointer flex-col items-center gap-0.5 rounded-[3px] px-1 pb-1.5 pt-[5px] font-hand text-[12.5px] font-bold leading-[1.2]",
            value === id
              ? "text-foreground shadow-[inset_0_0_0_2px_var(--mark)]"
              : "text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--subtle-foreground)]",
          )}
        >
          <span className="mb-[3px] grid aspect-video w-full place-items-center overflow-hidden">
            {quality !== null && picture ? (
              <img
                src={picture}
                alt=""
                className={cn("size-full object-cover", quality < 50 && "blur-[1.5px]")}
              />
            ) : (
              <Settings2 className="size-5 text-subtle-foreground" />
            )}
          </span>
          {label}
          <span
            className={cn(
              "font-mono text-[11px] font-normal",
              value === id ? "text-mark" : "text-subtle-foreground",
            )}
          >
            {quality === null ? "Your pick" : sizeAt(quality)}
          </span>
        </button>
      ))}
    </div>
  );
}
