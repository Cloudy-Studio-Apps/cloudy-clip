import { Copy, Images, Pipette, WandSparkles } from "lucide-react";
import { IconButton } from "@/ui";
import { ToggleLine } from "./ToggleLine";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";
import { COLOR_FIELDS, LIGHT_FIELDS } from "./basics.fields";
import { ValueSliders } from "./ValueSliders";
import { useMatchTool } from "../match.hook";
import { useToolEdit } from "../tool.edit.hook";
import { useTintSet } from "../view.set.hook";

/** Basics: light and color of the selected layer, and the One click buttons. Where a new grade starts. */
export function BasicsTool() {
  const { values, edit } = useToolEdit();
  const m = useMatchTool();
  const set = useTintSet();
  const from = m.others[0];
  return (
    <ToolColumns>
      <ToolColumn
        title="Light"
        info="Basics and Wheels change the same grade: move a slider here and the wheels follow."
      >
        <div key={edit.rev}>
          <ValueSliders fields={LIGHT_FIELDS} values={values} edit={edit} />
        </div>
      </ToolColumn>
      <ToolColumn title="Color">
        <div key={edit.rev}>
          <ValueSliders fields={COLOR_FIELDS} values={values} edit={edit} />
          <ToggleLine
            label="Protect skin"
            checked={values.protectSkin}
            disabled={!edit.enabled}
            onChange={(protectSkin) => void edit.commit({ values: { protectSkin } })}
          />
        </div>
      </ToolColumn>
      <ToolColumn title="One click" info="Balance and matching work on a clip's own grade.">
        <div className="flex gap-1">
          <IconButton
            label="Auto balance: neutral whites and even exposure in one click"
            disabled={!m.enabled}
            onClick={m.auto}
          >
            <WandSparkles />
          </IconButton>
          <IconButton
            label="Pick something white: click a white or gray spot in the viewer to set white balance"
            disabled={!m.enabled}
            active={m.balancePick === "white"}
            onClick={() => m.pick("white")}
          >
            <Pipette />
          </IconButton>
          <IconButton
            label={
              from
                ? `Match to ${from.no}: this clip takes on its colors`
                : "Match to another clip: Ctrl click it in the strip first"
            }
            disabled={!m.enabled || !from}
            onClick={() => from && m.clipId && m.shot([m.clipId], from.clip.id)}
          >
            <Copy />
          </IconButton>
          <IconButton
            label="Apply a look: open Looks and pick one"
            onClick={() => set({ leftTab: "looks" })}
          >
            <Images />
          </IconButton>
        </div>
      </ToolColumn>
    </ToolColumns>
  );
}
