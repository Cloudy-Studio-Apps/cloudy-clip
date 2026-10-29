import { usePoint } from "@/core";
import { getPath, propTypes, type PropSpec, type ResolvedItem } from "@/modules/element";
import { propertyControls } from "../inspector.points";
import type { PanelSubject, PropsLive } from "../inspector.types";
import { isEnabled, isVisible } from "../logic/conditions";
import { useWarnOnce } from "./panel.warn.hook";
import { WarningRow } from "./WarningRow";

interface FieldItemProps {
  item: Extract<ResolvedItem, { type: "field" }>;
  clip: PanelSubject;
  /** Every field of the subject by path. */
  fields: ReadonlyMap<string, PropSpec>;
  values: Record<string, unknown>;
  live: PropsLive;
}

/** One value of the clip or junction with its control, or a warning row when the control isn't registered. */
export function FieldItem({ item, clip, fields, values, live }: FieldItemProps) {
  const controls = usePoint(propertyControls);
  const types = usePoint(propTypes);
  const spec = fields.get(item.path);
  const typeMissing =
    spec?.kind === "custom" && !types.some((t) => t.name === spec.type) ? spec.type : undefined;
  const control = controls.find((c) => c.id === item.control && c.for === "field");
  const missing = spec && !control;
  useWarnOnce(
    missing
      ? `"${clip.kind}": control "${item.control}" for "${item.path}" is not registered (is its module loaded?)`
      : null,
  );
  if (!spec || !isVisible(spec, values)) return null;
  // The registry already logged it once (element.registry.ts).
  if (typeMissing !== undefined) {
    return (
      <WarningRow
        title={`"${item.label}" can't be shown.`}
        detail={`The value type "${typeMissing}" isn't registered. Its plugin may be missing or turned off.`}
      />
    );
  }
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
