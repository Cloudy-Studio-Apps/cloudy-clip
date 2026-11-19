import { useMemo } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { FieldRow, type CommandControlProps } from "@/modules/inspector";
import { previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { SelectField } from "@/ui";
import { detachPath } from "../path.follow.commands";
import { pathRef } from "../path.ref";

const NONE = "";
const DRAW = "path.draw";
const MIXED = "path.mixed";

/**
 * The `path-picker` command control (`path.attach`): which path the selected clips follow. A path
 * attaches them, None detaches them where they are at the playhead, and Draw new path starts
 * drawing one they will follow.
 */
export function PathPicker({ clipIds, label, run }: CommandControlProps) {
  const { bus } = useKernel();
  const { ui } = useModule(pathRef);
  const preview = useModule(previewRef);
  const store = useModule(projectRef).store;
  const clips = useStore(store.api, (s) => s.clips);
  const tracks = useStore(store.api, (s) => s.tracks);
  const paths = useStore(store.api, (s) => s.paths);

  const compositionId = tracks[clips[clipIds[0] ?? ""]?.trackId ?? ""]?.compositionId;
  const current = useMemo(() => {
    const ids = new Set(clipIds.map((id) => clips[id]?.follow?.pathId ?? NONE));
    return ids.size === 1 ? [...ids][0]! : MIXED;
  }, [clipIds, clips]);
  const options = useMemo(
    () => [
      ...(current === MIXED ? [{ value: MIXED, label: "Mixed" }] : []),
      { value: NONE, label: "None" },
      ...Object.values(paths ?? {})
        .filter((path) => path.compositionId === compositionId)
        .map((path) => ({ value: path.id, label: path.name })),
      { value: DRAW, label: "Draw new path…" },
    ],
    [current, paths, compositionId],
  );

  const choose = (value: string) => {
    if (value === DRAW) ui.setState({ drawing: { mode: "freehand", attach: clipIds } });
    else if (value === NONE) {
      void bus.run(detachPath, { clipIds, at: preview.playback.getTime() });
    } else if (value !== MIXED) run({ pathId: value });
  };

  return (
    <FieldRow label={label}>
      <SelectField
        label={label}
        className="w-full"
        value={current}
        options={options}
        onChange={choose}
      />
    </FieldRow>
  );
}
