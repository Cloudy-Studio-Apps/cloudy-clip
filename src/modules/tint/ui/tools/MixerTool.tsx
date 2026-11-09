import { GRADE_RANGES, type CorrectionValues } from "@/modules/project";
import { NumberField } from "@/ui";
import { useToolEdit } from "../tool.edit.hook";
import { CHANNEL_COLORS } from "./channel.colors";
import { ToggleLine } from "./ToggleLine";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";

const CHANNELS = ["R", "G", "B"] as const;

/** The matrix with one cell changed (rows out, columns in). */
function withCell(
  matrix: CorrectionValues["mixer"]["matrix"],
  row: number,
  column: number,
  value: number,
): CorrectionValues["mixer"]["matrix"] {
  return matrix.map((cells, r) =>
    cells.map((cell, c) => (r === row && c === column ? value : cell)),
  ) as CorrectionValues["mixer"]["matrix"];
}

/** RGB mixer: each output channel made from the three inputs, with keep brightness and monochrome. */
export function MixerTool() {
  const { values, edit } = useToolEdit();
  const mixer = values.mixer;
  const { min, max } = GRADE_RANGES["mixer.matrix"]!;
  const patch = (matrix: CorrectionValues["mixer"]["matrix"]) => ({
    values: { mixer: { ...mixer, matrix } },
  });
  return (
    <ToolColumns>
      <ToolColumn
        title="Output from input"
        info="Black and white from chosen channels, fixing one bad channel, cleaner skies by borrowing from green."
      >
        <div
          key={edit.rev}
          className="grid max-w-[340px] grid-cols-[52px_repeat(3,minmax(0,1fr))] items-center gap-2"
        >
          <span />
          {CHANNELS.map((name) => (
            <b key={name} className="text-center font-mono text-xs text-subtle-foreground">
              {name} in
            </b>
          ))}
          {mixer.matrix.map((cells, r) => (
            <div key={r} className="contents">
              <b className="font-mono text-xs" style={{ color: CHANNEL_COLORS[r] }}>
                {CHANNELS[r]} out
              </b>
              {cells.map((value, c) => (
                <span
                  key={c}
                  style={{ "--ch": CHANNEL_COLORS[c] } as React.CSSProperties}
                  className="[&_label]:border-b-2 [&_label]:border-(--ch)"
                >
                  <NumberField
                    label={`${CHANNELS[r]} out from ${CHANNELS[c]} in`}
                    value={value}
                    min={min}
                    max={max}
                    step={0.01}
                    disabled={!edit.enabled}
                    onChange={(next) => void edit.commit(patch(withCell(mixer.matrix, r, c, next)))}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
      </ToolColumn>
      <ToolColumn title="Options">
        <div key={edit.rev}>
          <ToggleLine
            label="Keep brightness"
            info="The numbers stay as typed; the picture is mixed with them scaled so a gray keeps its brightness (not when the rows add up to almost nothing or less)."
            checked={mixer.keepBrightness}
            disabled={!edit.enabled}
            onChange={(keepBrightness) =>
              void edit.commit({ values: { mixer: { ...mixer, keepBrightness } } })
            }
          />
          <ToggleLine
            label="Monochrome"
            checked={mixer.mono}
            disabled={!edit.enabled}
            onChange={(mono) => void edit.commit({ values: { mixer: { ...mixer, mono } } })}
          />
        </div>
      </ToolColumn>
    </ToolColumns>
  );
}
