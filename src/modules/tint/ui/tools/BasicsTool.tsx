import { ToggleLine } from "./ToggleLine";
import { ToolColumn } from "./ToolColumn";
import { ToolColumns } from "./ToolColumns";
import { COLOR_FIELDS, LIGHT_FIELDS } from "./basics.fields";
import { ValueSliders } from "./ValueSliders";
import { useToolEdit } from "../tool.edit.hook";

/** Basics: light and color of the selected layer. Where a new grade starts. */
export function BasicsTool() {
  const { values, edit } = useToolEdit();
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
    </ToolColumns>
  );
}
