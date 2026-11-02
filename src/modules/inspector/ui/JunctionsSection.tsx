import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { junctionRef } from "@/modules/junction";
import { junctionsOfClip, projectRef, useOpenFormat, type ProjectState } from "@/modules/project";
import type { InspectorContext } from "../inspector.types";
import { JunctionBody } from "./JunctionBody";

/** The junctions on the cuts of a clip and its partner, once each. */
export function clipJunctions(context: InspectorContext, project: ProjectState) {
  const ids = [context.clip.id, ...(context.partner ? [context.partner.clip.id] : [])];
  const found = new Map(ids.flatMap((id) => junctionsOfClip(project, id)).map((j) => [j.id, j]));
  return [...found.values()];
}

/** What sits on a clip's cuts: "In" on its start, "Out" on its end. */
export function JunctionsSection({ context }: { context: InspectorContext }) {
  const project = useModule(projectRef).store;
  const junctions = useModule(junctionRef);
  const format = useOpenFormat();
  const all = useStore(project.api, (s) => s.junctions);
  const list = useMemo(
    () => clipJunctions(context, project.getState()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `all` changes when a junction does
    [context, project, all],
  );
  const ids = [context.clip.id, context.partner?.clip.id];
  return list.map((junction) => (
    <JunctionBody
      key={junction.id}
      junctionId={junction.id}
      title={`${ids.includes(junction.rightClipId) ? "In" : "Out"} · ${junctions.display(junction, format).label}`}
    />
  ));
}
