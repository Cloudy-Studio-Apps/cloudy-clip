import { usePoint } from "@/core";
import type { PropSpec } from "@/modules/element";
import { fieldActions } from "../inspector.points";
import type { FieldActionProps } from "../inspector.types";

interface FieldActionsProps extends FieldActionProps {
  /** The fields of the row. An action shows when it applies to any of them. */
  specs: readonly PropSpec[];
}

/** The end of a row: what modules contributed to `fieldActions`. */
export function FieldActions({ specs, ...props }: FieldActionsProps) {
  const actions = usePoint(fieldActions);
  const shown = actions
    .filter((a) => !a.appliesTo || specs.some(a.appliesTo))
    .sort((a, b) => a.order - b.order);
  if (shown.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center">
      {shown.map(({ id, component: Action }) => (
        <Action key={id} {...props} />
      ))}
    </div>
  );
}
