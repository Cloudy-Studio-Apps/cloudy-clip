import { IconButton } from "@/ui";
import type { FieldControlProps } from "../../inspector.types";
import { pathPatch } from "../../logic/paths";
import { controlIcon } from "./controls.icons";
import { ControlIcon } from "./ControlIcon";

/** A square icon button that switches a value on and off (italic, uppercase). */
export function IconToggleControl({ path, spec, value, label, disabled, live }: FieldControlProps) {
  return (
    <IconButton
      label={label}
      active={value === true}
      disabled={disabled}
      onClick={() => live.commit(pathPatch(path, value !== true))}
    >
      {controlIcon(spec.icon) ? <ControlIcon name={spec.icon} /> : label.charAt(0)}
    </IconButton>
  );
}
