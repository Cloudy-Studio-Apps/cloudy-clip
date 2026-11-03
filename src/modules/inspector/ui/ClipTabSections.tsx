import type { ReactNode } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { selectionSubject, timelineRef } from "@/modules/timeline";
import { ClipTab } from "./ClipTab";

interface ClipTabSectionsProps {
  /** Id of an `inspectorTabs` entry (`"audio"`). */
  tab: string;
  /** Shown when no single clip is selected. */
  noClip?: ReactNode;
  /** Shown when the selected clip has nothing in that tab. */
  noSections?: ReactNode;
}

/**
 * The selected clip's sections of one tab, for a page without the inspector (the Sound page's
 * Clip tab). The clip is the one the inspector would show: a linked picture and sound count as one.
 */
export function ClipTabSections({ tab, noClip = null, noSections = null }: ClipTabSectionsProps) {
  const selection = useStore(useModule(timelineRef).view, (s) => s.selection);
  const subject = useStore(useModule(projectRef).store.api, (s) => selectionSubject(s, selection));
  if (!subject) return noClip;
  return <ClipTab key={subject} clipId={subject} tab={tab} empty={noSections} />;
}
