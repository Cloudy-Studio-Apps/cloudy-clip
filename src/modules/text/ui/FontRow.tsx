import { cssFontFamily, type FontSource } from "@/modules/fonts";
import { cn } from "@/ui";
import type { FontFamily } from "@/modules/fonts";
import { useFontStatus } from "./text.fonts.hook";

/** Height of a row of the picker, in pixels. */
export const FONT_ROW_HEIGHT = 28;

const SOURCE_LABEL: Record<FontSource, string> = {
  bundled: "Bundled",
  installed: "Installed",
  google: "Google",
};

interface FontRowProps {
  family: FontFamily;
  selected: boolean;
  onPick(): void;
}

/** One family: its name (in the app font until its face is loaded), its source, a missing note. */
export function FontRow({ family, selected, onPick }: FontRowProps) {
  const request = {
    family: family.family,
    source: family.source,
    weight: "400",
    style: "normal",
  } as const;
  const status = useFontStatus(request);
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      style={{ height: FONT_ROW_HEIGHT }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 px-2 text-left text-sm hover:bg-hover",
        selected && "bg-muted",
      )}
    >
      <span
        className="min-w-0 flex-1 truncate"
        style={status === "loaded" ? { fontFamily: cssFontFamily(request) } : undefined}
      >
        {family.family}
      </span>
      {status === "missing" && <span className="shrink-0 text-2xs text-destructive">Missing</span>}
      <span className="shrink-0 text-2xs text-subtle-foreground">
        {SOURCE_LABEL[family.source]}
      </span>
    </button>
  );
}
