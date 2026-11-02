import { useMemo, type ReactNode } from "react";
import { usePoint } from "@/core";
import { propTypes, type LayoutSource, type ResolvedItem } from "@/modules/element";
import type { PanelSubject, PropsLive } from "../inspector.types";
import { panelLayout } from "../logic/layout";
import { useWarnOnce } from "./panel.warn.hook";
import { PropertySection } from "./PropertySection";

interface PropertyPanelProps {
  /** What is edited: its id and kind. */
  subject: PanelSubject;
  /** The properties to draw: a junction kind's, or any other tree. */
  source: LayoutSource;
  /** The subject's resolved values. */
  values: Record<string, unknown>;
  /** Where input and commits go. */
  live: PropsLive;
  /** Draws a command item; without it, commands show as unavailable. */
  renderCommand?(item: Extract<ResolvedItem, { type: "command" }>, index: number): ReactNode;
}

/** Every section of a property tree, without tabs. Clips use `TabBody` instead. */
export function PropertyPanel({
  subject,
  source,
  values,
  live,
  renderCommand,
}: PropertyPanelProps) {
  const types = usePoint(propTypes);
  const layout = useMemo(() => panelLayout(source, types), [source, types]);
  useWarnOnce(layout.issues.map((i) => i.message).join("\n") || null);
  return layout.sections.map((section) => (
    <PropertySection
      key={section.key}
      subject={subject}
      source={source}
      section={section}
      values={values}
      live={live}
      renderCommand={renderCommand}
    />
  ));
}
