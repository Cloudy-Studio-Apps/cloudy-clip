import { useStore } from "zustand";
import { formatTimecode, useModule } from "@/core";
import { compositionRef } from "@/modules/composition";
import { projectRef, useOpenComposition } from "@/modules/project";
import { Button, InfoList, SealMark } from "@/ui";
import { AgentsSection } from "./AgentsSection";
import { InspectorHeader } from "./InspectorHeader";
import { InspectorSection } from "./InspectorSection";
import { InspectorTip } from "./InspectorTip";

/** Shown when nothing is selected: the project's canvas and how agents can join. */
export function ProjectView() {
  const project = useModule(projectRef).store;
  const compositions = useModule(compositionRef);
  const selected = useStore(compositions.ui, (s) => s.selected);
  const records = useStore(project.api, (s) => s.compositions);
  const open = useOpenComposition();
  const shown = (selected !== null && records[selected]) || open;
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
              { label: "Composition", value: shown?.name ?? "None" },
              ...(shown
                ? [
                    {
                      label: "Resolution",
                      value: `${shown.format.width} × ${shown.format.height}`,
                    },
                    {
                      label: "Frame rate",
                      value: `${Math.round(shown.format.fps * 100) / 100} fps`,
                    },
                    { label: "Length", value: formatTimecode(shown.duration) },
                  ]
                : []),
              { label: "Clips", value: String(clipCount) },
            ]}
          />
          {shown && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => compositions.openSettings(shown.id)}
            >
              Composition Settings
            </Button>
          )}
        </InspectorSection>
        <AgentsSection />
        <InspectorTip />
      </div>
    </>
  );
}
