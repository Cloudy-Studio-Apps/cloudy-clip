import type { ReactNode } from "react";
import type { InspectorContext } from "../inspector.types";
import { useClipPanel } from "./clip.panel.hook";
import { TabBody } from "./TabBody";

interface ClipTabBodyProps {
  context: InspectorContext;
  tab: string;
  /** Shown when the clip has nothing in that tab. */
  empty: ReactNode;
}

/** A clip's sections of one tab, drawn as the inspector draws them. */
export function ClipTabBody({ context, tab, empty }: ClipTabBodyProps) {
  const panel = useClipPanel(context, tab);
  if (panel.entries.length === 0) return empty;
  return <TabBody context={context} entries={panel.entries} />;
}
