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
            "flex cursor-pointer flex-col items-center gap-1 rounded-md border px-1 py-2 text-xs",
            value === id
              ? "border-primary bg-primary-soft text-primary-soft-foreground"
              : "border-border bg-muted text-foreground hover:border-border-strong",
          )}
        >
          <span className="grid h-11 w-full place-items-center overflow-hidden">
            {quality !== null && picture ? (
              <img
                src={picture}
                alt=""
                className={cn("max-h-11 max-w-full rounded-xs", quality < 50 && "blur-[1.5px]")}
              />
            ) : (
              <Settings2 className="size-5 text-muted-foreground" />
            )}
          </span>
          {label}
          <span className="font-mono text-2xs text-primary">
            {quality === null ? "Your pick" : sizeAt(quality)}
          </span>
        </button>
      ))}
    </div>
  );
}
