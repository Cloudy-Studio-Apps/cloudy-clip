import { useModule } from "@/core";
import { elementRef } from "@/modules/element";
import type { ClipId } from "@/modules/project";
import { inspectorRef } from "../inspector.ref";
import type { InspectorContext } from "../inspector.types";
import { useClipContext } from "./clip.context.hook";
import { useClipPanel } from "./clip.panel.hook";
import { InspectorTabs } from "./InspectorTabs";
import { TabBody } from "./TabBody";
import { WarningRow } from "./WarningRow";

/** The panel of a clip: the strip of tabs and the open tab's sections. No title: the timeline says what's selected. */
function ClipPanelView({ context }: { context: InspectorContext }) {
  const elements = useModule(elementRef);
  const view = useModule(inspectorRef).view;
  const { clip } = context;
  const panel = useClipPanel(context);
  const element = elements.get(clip.kind)?.definition;

  return (
    <>
      <InspectorTabs
        tabs={panel.tabs}
        active={panel.active}
        onPick={(id) => view.setTab(clip.kind, id)}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {!element && (
          <div className="p-3">
            <WarningRow
              title="These clips can't be edited."
              detail={`No module provides "${clip.kind}" clips. Its plugin may be missing or turned off.`}
            />
          </div>
        )}
        <TabBody context={context} entries={panel.entries} />
      </div>
    </>
  );
}

/** Details of one selected clip, with its linked partner when it has one. */
export function ClipView({ clipId }: { clipId: ClipId }) {
  const context = useClipContext(clipId);
  if (!context) return null;
  return <ClipPanelView context={context} />;
}
