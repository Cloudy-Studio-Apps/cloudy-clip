import { KeyAction } from "@/modules/keyframe";
import { FieldRow } from "@/modules/inspector";
import { formatOf, projectRef, type Clip, type ClipMask } from "@/modules/project";
import { useModule } from "@/core";
import { useMemo } from "react";
import { maskRows } from "../logic/fields";
import { pointPath, POINT_COORDS } from "../logic/keys";
import type { useMaskEdit } from "./mask.edit.hook";
import { MaskFieldRow } from "./MaskFieldRow";

interface MaskFieldsProps {
  clip: Clip;
  /** The mask at the playhead. */
  mask: ClipMask;
  edit: ReturnType<typeof useMaskEdit>;
}

/** The fields of the selected mask by its kind, each row with its diamond. */
export function MaskFields({ clip, mask, edit }: MaskFieldsProps) {
  const project = useModule(projectRef).store;
  const kind = mask.shape.kind;
  const rows = useMemo(
    () => maskRows(kind, formatOf(project.getState(), clip)),
    [kind, project, clip],
  );
  const { shape } = mask;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {rows.map((row) => (
        <MaskFieldRow key={row.label} clip={clip} mask={mask} row={row} edit={edit} />
      ))}
      {shape.kind === "path" && (
        <div data-field-row className="flex min-w-0 items-center gap-1">
          <FieldRow label="Path">
            <span className="text-base text-muted-foreground">
              {shape.pointOrder.length} points
            </span>
          </FieldRow>
          <KeyAction
            clip={clip}
            paths={shape.pointOrder.flatMap((pid) =>
              POINT_COORDS.map((c) => pointPath(mask.id, pid, c)),
            )}
          />
        </div>
      )}
    </div>
  );
}
