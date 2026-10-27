import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { formatPreset, projectRef, setFormat, type FormatPreset } from "@/modules/project";
import { SegmentedControl, type SegmentedOption } from "@/ui";

const PRESETS: readonly SegmentedOption<FormatPreset>[] = [
  { value: "9:16", label: "9:16", hint: "Reels, TikTok, Shorts" },
  { value: "1:1", label: "1:1", hint: "Square" },
  { value: "16:9", label: "16:9", hint: "YouTube, landscape" },
];

/** The project's aspect ratio. Changing it is an undoable edit. */
export function FormatPicker() {
  const { bus } = useKernel();
  const format = useStore(useModule(projectRef).store.api, (s) => s.format);

  return (
    <SegmentedControl
      label="Aspect ratio"
      options={PRESETS}
      value={formatPreset(format)}
      onChange={(preset) => void bus.run(setFormat, { preset })}
    />
  );
}
