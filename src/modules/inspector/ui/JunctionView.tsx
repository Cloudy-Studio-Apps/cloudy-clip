import { useStore } from "zustand";
import { microsToSeconds, useModule } from "@/core";
import { junctionRef } from "@/modules/junction";
import { projectRef, type JunctionId, useOpenFormat } from "@/modules/project";
import { InspectorHeader } from "./InspectorHeader";
import { JunctionBody } from "./JunctionBody";

/** Details of one junction selected on the timeline. */
export function JunctionView({ junctionId }: { junctionId: JunctionId }) {
  const project = useModule(projectRef).store;
  const junctions = useModule(junctionRef);
  const junction = useStore(project.api, (s) => s.junctions[junctionId]);
  const format = useOpenFormat();
  if (!junction) return null;
  const display = junctions.display(junction, format);
  const Icon = display.icon;
  const definition = junctions.get(junction.kind)?.definition;
  return (
    <>
      <InspectorHeader
        badge={<Icon />}
        title={display.label}
        subtitle={
          display.missing
            ? "Junction"
            : `${definition?.name ?? "Junction"} · ${microsToSeconds(junction.duration).toFixed(1)}s`
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <JunctionBody junctionId={junctionId} title="Junction" />
      </div>
    </>
  );
}
