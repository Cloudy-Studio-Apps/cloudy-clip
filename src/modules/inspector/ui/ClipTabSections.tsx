import type { ReactNode } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, type ClipId } from "@/modules/project";
import { selectionSubject, timelineRef } from "@/modules/timeline";
import type { InspectorContext } from "../inspector.types";
import { useClipContext } from "./clip.context.hook";
import { useClipPanel } from "./clip.panel.hook";
import { TabBody } from "./TabBody";

interface ClipTabSectionsProps {
  /** Id of an `inspectorTabs` entry (`"audio"`). */
  tab: string;
  /** Shown when no clip is selected, or the selected one has nothing in that tab. */
  fallback?: ReactNode;
}

/** The sections of one tab for a clip, drawn as the inspector draws them. */
function TabOf({ context, tab, fallback }: { context: InspectorContext } & ClipTabSectionsProps) {
  const panel = useClipPanel(context, tab);
  if (panel.entries.length === 0) return fallback;
  return <TabBody context={context} entries={panel.entries} />;
}

function ClipTabOf({ clipId, ...props }: { clipId: ClipId } & ClipTabSectionsProps) {
  const context = useClipContext(clipId);
  if (!context) return props.fallback;
  return <TabOf context={context} {...props} />;
}

/**
 * The selected clip's sections of one tab, for a page without the inspector (the Sound page's
 * Clip tab). The clip is the one the inspector would show: a linked picture and sound count as one.
 */
export function ClipTabSections({ tab, fallback = null }: ClipTabSectionsProps) {
  const selection = useStore(useModule(timelineRef).view, (s) => s.selection);
  const subject = useStore(useModule(projectRef).store.api, (s) => selectionSubject(s, selection));
  if (!subject) return fallback;
  return <ClipTabOf key={subject} clipId={subject} tab={tab} fallback={fallback} />;
}
