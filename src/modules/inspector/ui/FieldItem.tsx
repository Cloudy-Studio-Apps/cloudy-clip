import { useModule, usePoint } from "@/core";
import { elementRef, getPath, type ResolvedItem } from "@/modules/element";
import type { Clip } from "@/modules/project";
import { propertyControls } from "../inspector.points";
import type { PropsLive } from "../inspector.types";
import { isEnabled, isVisible } from "../logic/conditions";
import { useWarnOnce } from "./panel.warn.hook";
import { WarningRow } from "./WarningRow";

interface FieldItemProps {
  item: Extract<ResolvedItem, { type: "field" }>;
  clip: Clip;
  values: Record<string, unknown>;
  live: PropsLive;
}

/** One value of the clip with its control, or a warning row when the control isn't registered. */
export function FieldItem({ item, clip, values, live }: FieldItemProps) {
  const elements = useModule(elementRef);
  const controls = usePoint(propertyControls);
  const spec = elements.get(clip.kind)?.fields.get(item.path);
  const control = controls.find((c) => c.id === item.control && c.for === "field");
  const missing = spec && !control;
  useWarnOnce(
    missing
      ? `element "${clip.kind}": control "${item.control}" for "${item.path}" is not registered (is its module loaded?)`
      : null,
  );
  if (!spec || !isVisible(spec, values)) return null;
  if (!control || control.for !== "field") {
    return (
      <WarningRow
        title={`"${item.label}" can't be shown.`}
        detail={`The control "${item.control}" isn't registered. Its plugin may be missing or turned off.`}
      />
    );
  }
  const Control = control.component;
  return (
    <Control
      clip={clip}
      path={item.path}
      spec={spec}
      value={getPath(values, item.path)}
      values={values}
      label={item.label}
      disabled={!isEnabled(spec, values)}
      live={live}
    />
  );
}
