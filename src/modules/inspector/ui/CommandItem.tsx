import { z } from "zod";
import { useKernel, usePoint } from "@/core";
import { checkPanelCommand, type ResolvedItem } from "@/modules/element";
import type { Clip } from "@/modules/project";
import { propertyControls } from "../inspector.points";
import { useWarnOnce } from "./panel.warn.hook";
import { WarningRow } from "./WarningRow";

interface CommandItemProps {
  item: Extract<ResolvedItem, { type: "command" }>;
  clip: Clip;
}

/** A command placed in the panel: its control, or a warning row saying why it can't be used. */
export function CommandItem({ item, clip }: CommandItemProps) {
  const { bus } = useKernel();
  const controls = usePoint(propertyControls);
  const check = checkPanelCommand(item.id, bus.get(item.id));
  const label = item.label ?? bus.get(item.id)?.label ?? item.id;
  const controlId = !check.ok
    ? null
    : (item.control ??
      (!check.field ? "button" : check.field.schema instanceof z.ZodEnum ? "choices" : "unknown"));
  const control = controls.find((c) => c.id === controlId && c.for === "command");
  const problem = !check.ok
    ? check.message
    : !control
      ? `command "${item.id}": control "${controlId}" is not registered (is its module loaded?)`
      : null;
  useWarnOnce(problem && `element "${clip.kind}": ${problem}`);

  if (!check.ok) {
    const detail =
      check.reason === "missing"
        ? `The command "${item.id}" wasn't found. Its plugin may be missing or turned off.`
        : `"${item.id}" can't be used from a panel (${check.reason === "no_clip_ids" ? "it doesn't act on clips" : "it needs more than one value"}).`;
    return <WarningRow title={`"${label}" isn't available.`} detail={detail} />;
  }
  if (!control || control.for !== "command") {
    return (
      <WarningRow
        title={`"${label}" can't be shown.`}
        detail={`The control "${controlId}" isn't registered. Its plugin may be missing or turned off.`}
      />
    );
  }
  const Control = control.component;
  return (
    <Control
      clipIds={[clip.id]}
      commandId={item.id}
      {...(check.field && { field: check.field })}
      label={label}
      {...(item.icon !== undefined && { icon: item.icon })}
      run={(input) => void bus.execute(item.id, { ...input, clipIds: [clip.id] })}
    />
  );
}
