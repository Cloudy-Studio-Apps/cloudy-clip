import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { HEADER_WIDTH, timelineRef, timeToPx } from "@/modules/timeline";
import { collabRef } from "../collab.ref";
import type { Collaborator } from "../collab.types";

/** One agent's dashed playhead, placed from its clock without React renders. */
function AgentPlayhead({ who }: { who: Collaborator }) {
  const preview = useModule(previewRef);
  const timeline = useModule(timelineRef);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clock = preview.clockFor(who.id);
    const update = () => {
      const x = timeToPx(clock.getTime(), timeline.view.getState().pxPerSecond);
      if (ref.current) ref.current.style.transform = `translateX(${HEADER_WIDTH + x}px)`;
    };
    const offTime = clock.onTime(update);
    const offZoom = timeline.view.subscribe(update);
    return () => {
      offTime();
      offZoom();
    };
  }, [preview, timeline.view, who.id]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute top-0 bottom-0 left-0 z-[14] w-0 border-l-2 border-dashed transition-transform duration-700 ease-out"
      style={{ borderColor: who.color }}
    />
  );
}

/** Where each agent is in time, and the clip it is working on. */
export function AgentPlayheads() {
  const { store } = useModule(collabRef);
  const collaborators = useStore(store, (state) => state.collaborators);
  const agents = useMemo(
    () => Object.values(collaborators).filter((who) => who.kind === "agent"),
    [collaborators],
  );
  // A rule, not a prop on the clip: the target may be off the rendered pages.
  const outlines = agents
    .filter((who) => who.target?.startsWith("clip:"))
    .map(
      (who) =>
        `[data-collab-target="${who.target}"]{outline:2px solid ${who.color};outline-offset:-2px}`,
    )
    .join("");

  return (
    <>
      {outlines && <style>{outlines}</style>}
      {agents.map((who) => (
        <AgentPlayhead key={who.id} who={who} />
      ))}
    </>
  );
}
