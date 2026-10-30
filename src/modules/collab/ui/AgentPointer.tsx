import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { LOCAL_ACTOR, useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { cn } from "@/ui";
import { locate } from "../logic/locate";
import { collabRef } from "../collab.ref";
import type { Collaborator } from "../collab.types";

/** One agent's arrow, moved with `transform` so nothing re-renders as it travels. */
function Pointer({ who }: { who: Collaborator }) {
  const timeline = useModule(timelineRef);
  const { store: project, view } = useModule(projectRef);
  const ref = useRef<HTMLDivElement>(null);
  const { target } = who;

  useEffect(() => {
    if (!target) return;
    /** The composition a clip sits in, when it isn't the one the user sees. */
    const elsewhere = (clipId: string) => {
      const state = project.getState();
      const clip = state.clips[clipId];
      const home = clip && state.tracks[clip.trackId]?.compositionId;
      return home && home !== view.openFor(LOCAL_ACTOR) ? home : null;
    };
    const place = () => {
      const element = ref.current;
      const spot = locate(target, timeline, elsewhere);
      if (!element) return;
      element.style.opacity = spot ? "" : "0";
      if (spot) element.style.transform = `translate(${spot.x}px, ${spot.y}px)`;
    };
    place();
    const offScroll = timeline.onScroll(place);
    const offZoom = timeline.view.subscribe(place);
    const observer = new ResizeObserver(place);
    observer.observe(document.body);
    return () => {
      offScroll();
      offZoom();
      observer.disconnect();
    };
  }, [project, target, timeline, view]);

  if (!target) return null;
  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-0 left-0 transition-[transform,opacity] duration-500 ease-out",
        who.resting && "opacity-0",
      )}
    >
      <svg viewBox="0 0 16 18" className="size-4 drop-shadow" aria-hidden="true">
        <path d="M1 1l5 15 2.6-6.4L15 7z" fill={who.color} stroke="#fff" strokeWidth="1" />
      </svg>
      <span
        className="absolute top-4 left-3 max-w-56 truncate rounded-xs px-1.5 py-0.5 text-2xs font-medium whitespace-nowrap text-white"
        style={{ backgroundColor: who.color }}
      >
        {who.name}
        {who.activity ? ` · ${who.activity.label}` : ""}
      </span>
    </div>
  );
}

/** Where each agent is working, across the whole app. */
export function AgentPointers() {
  const { store } = useModule(collabRef);
  const collaborators = useStore(store, (state) => state.collaborators);
  const agents = useMemo(
    () => Object.values(collaborators).filter((who) => who.kind === "agent"),
    [collaborators],
  );
  return agents.map((who) => <Pointer key={who.id} who={who} />);
}
