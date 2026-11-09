import type { GradeLimit } from "@/modules/project";
import { SegmentedControl, Switch } from "@/ui";
import {
  BRIGHT_BANDS,
  BRIGHT_SOFT_START,
  brightBand,
  brightPart,
} from "../../logic/color/limit.edit";
import { barPair, percents } from "../../logic/range";
import type { LimitEdit } from "../ui.types";
import { LimitSlider } from "./LimitSlider";
import { RangeBar } from "./RangeBar";
import { ToolColumn } from "./ToolColumn";

const LUM = "linear-gradient(90deg, #000, #fff)";

/** Limit by brightness: on/off, Darks / Mids / Brights, the range and its softness. */
export function LimitBrightness({ edit }: { edit: LimitEdit }) {
  const { limit } = edit;
  const brightness = brightPart(limit);
  const withBrightness = (patch: Partial<typeof brightness>): GradeLimit => ({
    ...limit,
    brightness: { ...brightness, ...patch },
  });
  return (
    <ToolColumn
      title="By brightness"
      info="Only the darks, only the brights, or a band in between. No picking needed."
    >
      <div className="mb-2 flex items-center gap-3">
        <Switch
          label="Limit by brightness"
          checked={brightness.on}
          disabled={!edit.enabled}
          onChange={(on) => edit.commit(withBrightness({ on }))}
        />
        <span className="flex-1" />
        <SegmentedControl<keyof typeof BRIGHT_BANDS>
          label="Band"
          value={brightBand(brightness.range)}
          onChange={(band) =>
            edit.commit(withBrightness({ on: true, range: [...BRIGHT_BANDS[band]] }))
          }
          options={[
            { value: "darks", label: "Darks" },
            { value: "mids", label: "Mids" },
            { value: "brights", label: "Brights" },
          ]}
        />
      </div>
      <RangeBar
        label="Range"
        background={LUM}
        window={brightness.range}
        format={percents}
        disabled={!edit.enabled}
        onMove={(w) => edit.preview(withBrightness({ range: barPair(w) }))}
        onEnd={(w) => (w ? edit.commit(withBrightness({ range: barPair(w) })) : edit.cancel())}
      />
      <LimitSlider
        label="Softness"
        value={brightness.soft}
        resetTo={BRIGHT_SOFT_START}
        edit={edit}
        limitWith={(soft) => withBrightness({ soft })}
      />
    </ToolColumn>
  );
}
