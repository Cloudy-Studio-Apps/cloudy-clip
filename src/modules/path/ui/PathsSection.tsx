import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import { Button } from "@/ui";
import { pathRef } from "../path.ref";
import { PathRow } from "./PathRow";

/** The Library's motion paths of the open composition, with how many clips follow each. */
export function PathsSection() {
  const { ui } = useModule(pathRef);
  const store = useModule(projectRef).store;
  const composition = useOpenComposition();
  const paths = useStore(store.api, (s) => s.paths);
  const clips = useStore(store.api, (s) => s.clips);
  const selected = useStore(ui, (s) => s.selectedPathId);

  const listed = useMemo(
    () => Object.values(paths ?? {}).filter((p) => p.compositionId === composition?.id),
    [paths, composition],
  );
  const followers = useMemo(() => {
    const count = new Map<string, number>();
    for (const clip of Object.values(clips)) {
      const id = clip.follow?.pathId;
      if (id) count.set(id, (count.get(id) ?? 0) + 1);
    }
    return count;
  }, [clips]);

  if (!composition) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <h2 className="font-hand text-[13px] font-bold text-foreground">
          Paths
          {listed.length > 0 && <span className="ml-1.5 font-normal">· {listed.length}</span>}
        </h2>
        <Button
          variant="secondary"
          size="sm"
          title="Draw a path on the frame"
          onClick={() => ui.setState({ drawing: { mode: "freehand", attach: [] } })}
        >
          <Plus />
          New
        </Button>
      </div>
      {listed.length > 0 && (
        <div className="flex flex-col gap-1">
          {listed.map((path) => (
            <PathRow
              key={path.id}
              path={path}
              followers={followers.get(path.id) ?? 0}
              selected={selected === path.id}
              onSelect={() =>
                ui.setState({
                  selectedPathId: selected === path.id ? null : path.id,
                  selectedPoint: null,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
