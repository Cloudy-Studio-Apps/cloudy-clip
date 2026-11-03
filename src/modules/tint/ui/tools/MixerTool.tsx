import { ToggleLine } from "./ToggleLine";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";

/** Data colors of the channels, and the demo matrix (rows: output, columns: input). */
const CHANNELS = [
  ["R", "#e0545a"],
  ["G", "#4fbf6a"],
  ["B", "#4d8fe0"],
] as const;
const MATRIX = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0.05, 0.95],
] as const;

/** RGB mixer: each output channel made from the three inputs. */
export function MixerTool() {
  return (
    <ToolColumns>
      <ToolColumn
        title="Output from input"
        info="Black and white from chosen channels, fixing one bad channel, cleaner skies by borrowing from green."
      >
        <div className="grid grid-cols-[52px_repeat(3,1fr)] items-center gap-2">
          <span />
          {CHANNELS.map(([name]) => (
            <b key={name} className="text-center font-mono text-xs text-subtle-foreground">
              {name} in
            </b>
          ))}
          {MATRIX.map((row, r) => (
            <div key={r} className="contents">
              <b className="font-mono text-xs" style={{ color: CHANNELS[r]![1] }}>
                {CHANNELS[r]![0]} out
              </b>
              {row.map((value, c) => (
                <span
                  key={c}
                  className="rounded-xs bg-background px-1.5 py-1 text-right font-mono text-sm"
                  style={{ borderBottom: `2px solid ${CHANNELS[c]![1]}` }}
                >
                  {value.toFixed(2)}
                </span>
              ))}
            </div>
          ))}
        </div>
      </ToolColumn>
      <ToolColumn title="Options">
        <ToggleLine label="Keep brightness" on />
        <ToggleLine label="Monochrome" />
      </ToolColumn>
    </ToolColumns>
  );
}
