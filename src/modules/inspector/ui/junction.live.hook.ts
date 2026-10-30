import { useEffect, useMemo } from "react";
import { useKernel, useModule } from "@/core";
import { junctionRef, setJunction } from "@/modules/junction";
import { projectRef, type JunctionId, formatOfTrack } from "@/modules/project";
import type { PropsLive } from "../inspector.types";
import { createPropsLive } from "../logic/live";
import { junctionSetInput } from "../logic/junction";

/**
 * Editing of a junction's values for the inspector's fields: input is held until the release,
 * which runs one `junction.set` (one undo step). A junction has no live preview.
 */
export function useJunctionLive(id: JunctionId): PropsLive {
  const { bus } = useKernel();
  const project = useModule(projectRef).store;
  const junctions = useModule(junctionRef);
  const live = useMemo(
    () =>
      createPropsLive({
        preview: () => {},
        read: () => {
          const state = project.getState();
          const now = state.junctions[id];
          return now ? junctions.resolve(now, formatOfTrack(state, now.trackId)) : null;
        },
        commit: (patch) => bus.run(setJunction, junctionSetInput(id, { patch })),
      }),
    [bus, junctions, project, id],
  );
  useEffect(() => () => live.dispose(), [live]);
  return live;
}
