import { Minus, Pipette, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { notify } from "@/core";
import type { GradeLimit } from "@/modules/project";
import { IconButton, Switch } from "@/ui";
import {
  PICK_SOFT,
  colorPart,
  narrowLimit,
  pickLimit,
  widenLimit,
} from "../../logic/color/limit.edit";
import { barHue, barPair, hueBar, percents } from "../../logic/range";
import type { LimitPick } from "../../tint.types";
import type { LimitEdit } from "../ui.types";
import { useTintView } from "../view.hook";
import { useTintSet } from "../view.set.hook";
import { HUE_STOPS } from "./hue.stops";
import { LimitSlider } from "./LimitSlider";
import { RangeBar } from "./RangeBar";
import { ToolColumn } from "./ToolColumn";

const HUE = `linear-gradient(90deg, ${HUE_STOPS})`;
const SAT = "linear-gradient(90deg, #888, #e05a3a)";
const LUM = "linear-gradient(90deg, #000, #fff)";

const degrees = ([a, b]: readonly [number, number]) =>
  `${Math.round(a * 360)}°–${Math.round(b * 360)}°`;
const DROPPERS: readonly { pick: LimitPick; label: string; icon: typeof Pipette }[] = [
  { pick: "pick", label: "Pick: click a color in the viewer", icon: Pipette },
  { pick: "add", label: "Add: click a color in the viewer to take it in", icon: Plus },
  { pick: "cut", label: "Leave out: click a color in the viewer to take it out", icon: Minus },
];

/** Limit by color: on/off, the droppers, the hue, saturation and brightness ranges and softness. */
export function LimitColor({ edit }: { edit: LimitEdit }) {
  const picking = useTintView((v) => v.picking);
  const picked = useTintView((v) => v.picked);
  const set = useTintSet();
  const [dropper, setDropper] = useState<LimitPick>("pick");
  const { limit } = edit;
  const color = colorPart(limit);
  const withColor = (patch: Partial<typeof color>): GradeLimit => ({
    ...limit,
    color: { ...color, ...patch },
  });

  // A color picked in the viewer goes to the dropper that asked for it.
  useEffect(() => {
    if (picked === null) return;
    set({ picked: null });
    if (!edit.enabled) return;
    const next =
      dropper === "pick"
        ? pickLimit(limit, picked)
        : dropper === "add"
          ? widenLimit(limit, picked)
          : narrowLimit(limit, picked);
    if (next) edit.commit(next);
    else notify("info", "That color is already left out of the picked colors.");
  }, [picked, set, dropper, limit, edit]);

  const bar = (field: "sat" | "lum") => ({
    window: color[field],
    format: percents,
    disabled: !edit.enabled,
    onMove: (w: [number, number]) => edit.preview(withColor({ [field]: barPair(w) })),
    onEnd: (w: [number, number] | null) =>
      w ? edit.commit(withColor({ [field]: barPair(w) })) : edit.cancel(),
  });

  return (
    <ToolColumn
      title="By color"
      info="Pick a color in the picture with the dropper; only colors like it change. + takes in more colors, − leaves one out. Drag a range's ends or its middle to adjust it."
    >
      <div className="mb-2 flex items-center gap-2">
        <Switch
          label="Limit by color"
          checked={color.on}
          disabled={!edit.enabled}
          onChange={(on) => edit.commit(withColor({ on }))}
        />
        <span className="flex-1" />
        {DROPPERS.map(({ pick, label, icon: Icon }) => (
          <IconButton
            key={pick}
            label={label}
            active={picking && dropper === pick}
            disabled={!edit.enabled || (pick === "cut" && !color.on)}
            onClick={() => {
              setDropper(pick);
              set({ picking: !(picking && dropper === pick) });
            }}
          >
            <Icon />
          </IconButton>
        ))}
      </div>
      <RangeBar
        label="Hue"
        background={HUE}
        wrap
        window={hueBar(color.hue)}
        format={degrees}
        disabled={!edit.enabled}
        onMove={(w) => edit.preview(withColor({ hue: barHue(w) }))}
        onEnd={(w) => (w ? edit.commit(withColor({ hue: barHue(w) })) : edit.cancel())}
      />
      <RangeBar label="Saturation" background={SAT} {...bar("sat")} />
      <RangeBar label="Brightness" background={LUM} {...bar("lum")} />
      <LimitSlider
        label="Softness"
        value={color.soft}
        resetTo={PICK_SOFT}
        edit={edit}
        limitWith={(soft) => withColor({ soft })}
      />
    </ToolColumn>
  );
}
