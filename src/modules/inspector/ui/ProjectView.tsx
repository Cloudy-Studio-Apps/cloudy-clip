import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenFormat } from "@/modules/project";
import { InfoList, SealMark } from "@/ui";
import { AgentsSection } from "./AgentsSection";
import { InspectorHeader } from "./InspectorHeader";
import { InspectorSection } from "./InspectorSection";
import { InspectorTip } from "./InspectorTip";

/** Shown when nothing is selected: the project's canvas and how agents can join. */
export function ProjectView() {
  const project = useModule(projectRef).store;
  const format = useOpenFormat();
  const clipCount = useStore(project.api, (s) => Object.keys(s.clips).length);

  return (
    <>
      <InspectorHeader
        badge={<SealMark className="!size-[26px]" />}
        badgeClassName="bg-primary-soft"
        title="Untitled project"
        subtitle="Project · nothing selected"
      />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <InspectorSection title="Canvas">
          <InfoList
            rows={[
              { label: "Resolution", value: `${format.width} × ${format.height}` },
              { label: "Frame rate", value: `${format.fps} fps` },
              { label: "Clips", value: String(clipCount) },
            ]}
          />
        </InspectorSection>
        <AgentsSection />
        <InspectorTip />
      </div>
    </>
  );
}
