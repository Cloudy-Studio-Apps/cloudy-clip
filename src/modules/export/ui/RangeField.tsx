import { microsToSeconds, secondsToMicros, useModule, type Micros } from "@/core";
import { SelectField, SliderField } from "@/ui";
import { exportRef } from "../export.ref";
import { ExportRow } from "./ExportRow";

interface RangeFieldProps {
  whole: boolean;
  from: Micros;
  to: Micros;
  /** Length of the composition. */
  duration: Micros;
}

const OPTIONS = [
  { value: "whole", label: "Whole timeline" },
  { value: "part", label: "Only a part" },
];

/** All of the timeline, or part of it. */
export function RangeField({ whole, from, to, duration }: RangeFieldProps) {
  const { form } = useModule(exportRef);
  const seconds = microsToSeconds(duration);
  const setFrom = (value: number) => form.setState({ from: secondsToMicros(value) });
  const setTo = (value: number) => form.setState({ to: secondsToMicros(value) });
  return (
    <>
      <ExportRow label="Export">
        <SelectField
          label="What part to export"
          value={whole ? "whole" : "part"}
          options={OPTIONS}
          onChange={(value) => form.setState({ whole: value === "whole" })}
        />
      </ExportRow>
      {!whole && (
        <div className="flex flex-col gap-1">
          <SliderField
            label="From"
            unit="s"
            value={microsToSeconds(from)}
            min={0}
            max={seconds}
            step={0.1}
            onInput={setFrom}
            onCommit={setFrom}
          />
          <SliderField
            label="To"
            unit="s"
            value={microsToSeconds(to)}
            min={0}
            max={seconds}
            step={0.1}
            onInput={setTo}
            onCommit={setTo}
          />
        </div>
      )}
    </>
  );
}
