import { SegmentedControl, type SegmentedOption } from "@/ui";
import { soon } from "../soon";

const PLACEHOLDER = soon("mixer.filter");

const FILTERS: readonly SegmentedOption<"all">[] = [
  { value: "all", label: "All", hint: PLACEHOLDER.title },
];

/**
 * Which strips the mixer shows: All, the only filter yet, always chosen; choosing it changes
 * nothing. A filter per group (Dialogue, Music & FX…) comes in stage 4 with the groups; this
 * project has none, so none is offered (Ruling 1). Its tooltip says so.
 */
export function MixerFilter() {
  return (
    <SegmentedControl
      label="Show strips"
      className="shrink-0 [&_button]:cursor-default"
      options={FILTERS}
      value="all"
      onChange={PLACEHOLDER.onClick}
    />
  );
}
