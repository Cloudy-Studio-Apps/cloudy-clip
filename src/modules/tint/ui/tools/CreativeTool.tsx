import { DEFAULT_CORRECTION } from "@/modules/project";
import { useToolEdit } from "../tool.edit.hook";
import { ColorWheel } from "./ColorWheel";
import { GradeSlider } from "./GradeSlider";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";
import { wheelEdit } from "./wheel.edit";

const TINTS = [
  ["shadowTint", "Shadow tint"],
  ["highlightTint", "Highlight tint"],
] as const;

const VIGNETTE = [
  ["amount", "Amount"],
  ["midpoint", "Midpoint"],
  ["roundness", "Roundness"],
  ["feather", "Feather"],
] as const;

/** Creative: split toning, faded film and a vignette, on the selected layer. */
export function CreativeTool() {
  const { values, edit } = useToolEdit();
  const creative = values.creative;
  const neutral = DEFAULT_CORRECTION.creative;
  return (
    <ToolColumns>
      <ToolColumn
        title="Split toning"
        info="Tint the shadows and the highlights with different colors, like teal shadows and warm highlights."
      >
        <div key={edit.rev}>
          <div className="mb-3 flex gap-4">
            {TINTS.map(([key, label]) => (
              <ColorWheel
                key={key}
                label={label}
                wheel={{ ...creative[key], m: 0 }}
                size={84}
                numbers="none"
                edit={
                  edit.enabled
                    ? wheelEdit(
                        edit,
                        { ...creative[key], m: 0 },
                        { x: 0, y: 0, m: 0 },
                        ({ x, y }) => ({
                          values: { creative: { ...creative, [key]: { x, y } } },
                        }),
                      )
                    : undefined
                }
              />
            ))}
          </div>
          <GradeSlider
            path="creative.balance"
            label="Balance"
            step={1}
            value={creative.balance}
            resetTo={neutral.balance}
            edit={edit}
            patch={(balance) => ({ values: { creative: { ...creative, balance } } })}
          />
        </div>
      </ToolColumn>
      <ToolColumn title="Film" info="Faded film lifts the blacks and quiets the colors.">
        <div key={edit.rev}>
          <GradeSlider
            path="creative.fade"
            label="Faded film"
            step={1}
            value={creative.fade}
            resetTo={neutral.fade}
            edit={edit}
            patch={(fade) => ({ values: { creative: { ...creative, fade } } })}
          />
        </div>
      </ToolColumn>
      <ToolColumn
        title="Vignette"
        info="Darken or lighten the edges to pull the eye to the middle."
      >
        <div key={edit.rev} className="flex flex-col gap-1">
          {VIGNETTE.map(([key, label]) => (
            <GradeSlider
              key={key}
              path={`creative.vignette.${key}`}
              label={label}
              step={1}
              value={creative.vignette[key]}
              resetTo={neutral.vignette[key]}
              edit={edit}
              patch={(value) => ({
                values: {
                  creative: { ...creative, vignette: { ...creative.vignette, [key]: value } },
                },
              })}
            />
          ))}
        </div>
      </ToolColumn>
    </ToolColumns>
  );
}
