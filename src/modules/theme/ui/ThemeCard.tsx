import { useState } from "react";
import { cn, SegmentedControl } from "@/ui";
import type { ThemeAppearance, ThemeFamily } from "../theme.types";
import { ThemePicture } from "./ThemePicture";

const VARIANTS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

interface ThemeCardProps {
  family: ThemeFamily;
  selectedId: string;
  onSelect(id: string): void;
  /** The variant a family with both shows until one is picked: the app's current appearance. */
  preferred: ThemeAppearance;
}

/** One family as a card, with a Light/Dark switch when it has both. */
export function ThemeCard({ family, selectedId, onSelect, preferred }: ThemeCardProps) {
  const [picked, setPicked] = useState<ThemeAppearance | null>(null);
  const { light, dark } = family;
  const selected = light?.id === selectedId || dark?.id === selectedId;
  const wanted = selected ? (light?.id === selectedId ? "light" : "dark") : (picked ?? preferred);
  const theme = (wanted === "light" ? (light ?? dark) : (dark ?? light))!;

  const pickVariant = (appearance: ThemeAppearance) => {
    setPicked(appearance);
    const variant = family[appearance];
    if (selected && variant) onSelect(variant.id);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(theme.id)}
        className={cn(
          "cursor-pointer overflow-hidden rounded-sm border text-left",
          selected ? "border-mark" : "border-border hover:border-border-strong",
        )}
      >
        <ThemePicture preview={theme.preview} />
        <span className="block border-t border-border bg-surface px-2 py-1.5">
          <span className="block font-hand text-sm font-bold">{family.label}</span>
          {theme.description && (
            <span className="block text-xs text-muted-foreground">{theme.description}</span>
          )}
        </span>
      </button>
      {light && dark && (
        <SegmentedControl
          label={`${family.label} variant`}
          value={theme.appearance}
          onChange={pickVariant}
          options={VARIANTS}
        />
      )}
    </div>
  );
}
