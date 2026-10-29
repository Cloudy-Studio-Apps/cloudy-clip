import { CHECKERBOARD } from "./kit.color";

interface ColorSwatchesProps {
  label: string;
  colors: readonly string[];
  /** The current color, outlined when present. */
  selected?: string;
  onPick(color: string): void;
}

/** A row of small color squares. */
export function ColorSwatches({ label, colors, selected, onPick }: ColorSwatchesProps) {
  if (colors.length === 0) return null;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          title={color}
          aria-label={color}
          onClick={() => onPick(color)}
          className={`size-5 cursor-pointer rounded-xs border ${color === selected ? "border-foreground" : "border-border"}`}
          style={{ background: `linear-gradient(${color}, ${color}), ${CHECKERBOARD}` }}
        />
      ))}
    </div>
  );
}
