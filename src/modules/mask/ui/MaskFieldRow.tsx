import { KeyAction } from "@/modules/keyframe";
import { FieldRow } from "@/modules/inspector";
import type { Clip, ClipMask } from "@/modules/project";
import { SliderField } from "@/ui";
import type { MaskRowSpec } from "../mask.types";
import type { useMaskEdit } from "./mask.edit.hook";

interface MaskFieldRowProps {
  /** The clip as saved: the diamonds read its keys. */
  clip: Clip;
  /** The mask at the playhead. */
  mask: ClipMask;
  row: MaskRowSpec;
  edit: ReturnType<typeof useMaskEdit>;
}

const read = (mask: ClipMask, name: string, shape?: true) =>
  ((shape ? mask.shape : mask) as unknown as Record<string, number>)[name] ?? 0;

/** One field row of the selected mask: sliders drawn live while dragging, one command on release. */
export function MaskFieldRow({ clip, mask, row, edit }: MaskFieldRowProps) {
  const paths = row.fields.map((f) => `masks.${mask.id}.${f.shape ? "shape." : ""}${f.name}`);
  const patchOf = (name: string, shape: true | undefined, value: number) =>
    shape ? { shape: { [name]: value } } : { [name]: value };
  return (
    <div data-field-row className="flex min-w-0 items-center gap-1">
      <FieldRow label={row.label}>
        {row.fields.map((f) => {
          const k = f.show ?? 1;
          const stored = (value: number) => Math.round((value / k) * 1e4) / 1e4;
          return (
            <SliderField
              key={f.name}
              label={row.label}
              bare
              value={Math.round(read(mask, f.name, f.shape) * k * 100) / 100}
              min={f.min}
              max={f.max}
              step={f.step}
              unit={f.unit}
              onInput={(v) => edit.live(mask.id, patchOf(f.name, f.shape, stored(v)))}
              onCommit={(v) => void edit.update(mask.id, patchOf(f.name, f.shape, stored(v)))}
            />
          );
        })}
      </FieldRow>
      <KeyAction clip={clip} paths={paths} />
    </div>
  );
}
