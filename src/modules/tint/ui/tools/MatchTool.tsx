import { useEffect } from "react";
import { Pipette, WandSparkles } from "lucide-react";
import { useKernel } from "@/core";
import { DEFAULT_CORRECTION } from "@/modules/project";
import { Button } from "@/ui";
import { CHART_REFERENCE } from "../../logic/chart";
import { match } from "../../tint.match.commands";
import type { ChartCorners } from "../../tint.types";
import { useMatchTool } from "../match.hook";
import { settle } from "../settle";
import { useToolEdit } from "../tool.edit.hook";
import { useTintView } from "../view.hook";
import { useTintSet } from "../view.set.hook";
import { GradeSlider } from "./GradeSlider";
import { ToggleLine } from "./ToggleLine";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";

/** Where the chart's corners start: a box in the middle of the frame. */
const START: ChartCorners = [
  { u: 0.3, v: 0.25 },
  { u: 0.7, v: 0.25 },
  { u: 0.7, v: 0.75 },
  { u: 0.3, v: 0.75 },
];

const css = (rgb: readonly number[]) => `rgb(${rgb.map((c) => Math.round(c * 255)).join(" ")})`;

/**
 * Match: balance, match another shot, calibrate from a color chart, pull skin to its line. Works on
 * the current clip's own grade (`tint.match`), so it is off at the shot group and timeline levels.
 */
export function MatchTool() {
  const { bus } = useKernel();
  const m = useMatchTool();
  const { values, edit } = useToolEdit();
  const chart = useTintView((v) => v.chart);
  const set = useTintSet();
  useEffect(() => () => set({ chart: null }), [set]);
  const off = !m.enabled;
  const from = m.others[0];
  const calibrate = async () => {
    if (!m.clipId || !chart) return;
    const done = await settle(
      bus.run(match, { clipIds: [m.clipId], kind: "chart", corners: chart }),
    );
    if (done.ok) set({ chart: null });
  };
  return (
    <ToolColumns min={180} gap={28}>
      <ToolColumn title="Balance" info="Into the selected correction, else the first one.">
        <div className="flex flex-col items-start gap-2">
          <Button
            size="sm"
            disabled={off}
            onClick={m.auto}
            title="Auto balance: neutral whites and even exposure in one click"
          >
            <WandSparkles /> Auto
          </Button>
          <Button
            size="sm"
            disabled={off}
            aria-pressed={m.balancePick === "white"}
            onClick={() => m.pick("white")}
            title="Pick white: click something white in the viewer"
          >
            <Pipette /> White
          </Button>
          <Button
            size="sm"
            disabled={off}
            aria-pressed={m.balancePick === "gray"}
            onClick={() => m.pick("gray")}
            title="Pick gray: click something gray in the viewer"
          >
            <Pipette /> Gray
          </Button>
        </div>
      </ToolColumn>
      <ToolColumn
        title="Another shot"
        info="Ctrl click a clip in the strip: this one takes on its colors, in a new Match layer at the bottom."
      >
        <div className="flex flex-col items-start gap-2">
          <Button
            size="sm"
            disabled={off || !from}
            onClick={() => from && m.clipId && m.shot([m.clipId], from.clip.id)}
            title="Match this clip to the clip selected in the strip"
          >
            {from ? `Match to ${from.no}` : "Match to…"}
          </Button>
          <Button
            size="sm"
            disabled={off || m.others.length === 0}
            onClick={() =>
              m.clipId &&
              m.shot(
                m.others.map((entry) => entry.clip.id),
                m.clipId,
              )
            }
            title="Match all to this: every selected clip takes this clip's colors"
          >
            <WandSparkles /> Match all to this
          </Button>
        </div>
      </ToolColumn>
      <ToolColumn
        title="Color chart"
        info="Film a 24-patch color chart at the start of a shoot. Place its four corners on it in the viewer (dark skin at the top left), then Calibrate: a Chart layer at the top."
      >
        <div className="mb-2.5 grid max-w-[200px] grid-cols-6 gap-[3px] rounded-sm bg-surface-sunken p-1.5">
          {CHART_REFERENCE.map((rgb, i) => (
            <i
              key={i}
              className="block aspect-square rounded-[1px]"
              style={{ background: css(rgb) }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={off}
            aria-pressed={chart !== null}
            onClick={() => set({ chart: chart ? null : START })}
            title="Place the chart's corners in the viewer"
          >
            {chart ? "Hide" : "Place"}
          </Button>
          <Button
            size="sm"
            disabled={off || !chart}
            onClick={() => void calibrate()}
            title="Calibrate: correct the clip so every patch reads right"
          >
            Calibrate
          </Button>
        </div>
      </ToolColumn>
      <ToolColumn title="Skin" info="Pulls faces toward the skin line on the vectorscope.">
        <div key={edit.rev}>
          <GradeSlider
            path="skinPull"
            label="Pull"
            step={1}
            value={values.skinPull}
            resetTo={DEFAULT_CORRECTION.skinPull}
            edit={edit}
            patch={(skinPull) => ({ values: { skinPull } })}
          />
          <ToggleLine
            label="Protect skin"
            checked={values.protectSkin}
            disabled={!edit.enabled}
            onChange={(protectSkin) => void edit.commit({ values: { protectSkin } })}
          />
        </div>
      </ToolColumn>
    </ToolColumns>
  );
}
