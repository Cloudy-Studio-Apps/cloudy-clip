import { Fragment } from "react";
import type { SoundPreset } from "../../sound.types";

interface PresetOthersProps {
  /** The built-in presets that fit the strip. */
  builtIn: readonly SoundPreset[];
  /** The user's own that fit, marked "yours". */
  own: readonly SoundPreset[];
  /** Runs `sound.applyPreset` with one of them. */
  onApply(presetId: string): void;
}

/** "Others": the presets that fit the strip as a line of text links; a click applies one. */
export function PresetOthers({ builtIn, own, onApply }: PresetOthersProps) {
  const links = [
    ...builtIn.map((preset) => ({ preset, name: preset.name })),
    ...own.map((preset) => ({ preset, name: `${preset.name} (yours)` })),
  ];
  if (links.length === 0) return null;
  return (
    <div className="flex flex-col">
      <span className="flex min-h-[25px] items-center text-muted-foreground">Others</span>
      <p className="text-sm text-subtle-foreground">
        {links.map(({ preset, name }, index) => (
          <Fragment key={preset.id}>
            {index > 0 && ", "}
            <button
              type="button"
              title={preset.description || `Apply ${preset.name}`}
              className="cursor-pointer underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
              onClick={() => onApply(preset.id)}
            >
              {name}
            </button>
          </Fragment>
        ))}
      </p>
    </div>
  );
}
