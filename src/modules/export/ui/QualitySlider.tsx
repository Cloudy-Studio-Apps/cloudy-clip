import { useModule } from "@/core";
import { SliderField } from "@/ui";
import { exportRef } from "../export.ref";
import { kindOf } from "../logic/presets";
import { ExportHeading } from "./ExportHeading";

/** From a smaller file to a sharper picture. */
export function QualitySlider({ value }: { value: number }) {
  const { form } = useModule(exportRef);
  const change = (quality: number) => form.setState({ quality, kind: kindOf(quality) });
  return (
    <section className="flex flex-col gap-1.5">
      <ExportHeading>Quality</ExportHeading>
      <SliderField
        label="Quality"
        value={value}
        min={10}
        max={100}
        step={1}
        onInput={change}
        onCommit={change}
      />
      <div className="flex justify-between text-2xs text-subtle-foreground">
        <span>Smaller file</span>
        <span>Sharper picture</span>
      </div>
    </section>
  );
}
