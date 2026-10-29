import { useMemo, type ReactNode } from "react";
import { usePoint } from "@/core";
import {
  defaultControl,
  propTypes,
  resolveLayout,
  type LayoutSource,
  type ResolvedItem,
  type ResolvedSection,
} from "@/modules/element";
import { sectionLayouts } from "../inspector.points";
import type { PanelSubject, PropsLive } from "../inspector.types";
import { isEnabled } from "../logic/conditions";
import { FieldItem } from "./FieldItem";
import { useWarnOnce } from "./panel.warn.hook";
import { SubSection } from "./SubSection";
import { WarningRow } from "./WarningRow";

interface PropertyPanelProps {
  /** What is edited (a clip, a junction): its id and kind. */
  subject: PanelSubject;
  /** The properties to draw: an element, or any other tree (a junction kind's). */
  source: LayoutSource;
  /** The subject's resolved values. */
  values: Record<string, unknown>;
  /** Where input and commits go: `element.setProps` for clips, `junction.set` for junctions. */
  live: PropsLive;
  /** Leaves a section out (a shared group that doesn't apply to the clip). */
  include?(section: ResolvedSection): boolean;
  /** Draws a command item; without it, commands show as unavailable. */
  renderCommand?(item: Extract<ResolvedItem, { type: "command" }>, index: number): ReactNode;
}

/**
 * The sections of a property tree, generated from its layout (or its properties): each drawn by
 * its section layout, each item by its control. Commits go through `live`, so the same panel
 * edits clips and junctions.
 */
export function PropertyPanel({
  subject,
  source,
  values,
  live,
  include,
  renderCommand,
}: PropertyPanelProps) {
  const types = usePoint(propTypes);
  const layouts = usePoint(sectionLayouts);
  const layout = useMemo(
    () =>
      resolveLayout(source, (_path, spec) =>
        defaultControl(spec, spec.type ? types.find((t) => t.name === spec.type) : undefined),
      ),
    [source, types],
  );
  useWarnOnce(layout.issues.map((i) => i.message).join("\n") || null);

  const enabled = (path: string) => {
    const spec = source.fields.get(path);
    return spec !== undefined && isEnabled(spec, values);
  };
  const renderItem = (item: ResolvedItem, index: number): ReactNode => {
    switch (item.type) {
      case "field":
        return (
          <FieldItem
            key={item.path}
            item={item}
            clip={subject}
            fields={source.fields}
            values={values}
            live={live}
          />
        );
      case "command":
        return (
          renderCommand?.(item, index) ?? (
            <WarningRow
              key={`${item.id}:${index}`}
              title={`"${item.label ?? item.id}" isn't available.`}
              detail="Commands can't be used here."
            />
          )
        );
      case "row":
        return (
          <div key={index} className="flex items-center gap-1.5">
            {item.items.map(renderItem)}
          </div>
        );
      case "sub":
        return (
          <SubSection key={index} item={item} values={values} live={live} enabled={enabled}>
            {item.items.map(renderItem)}
          </SubSection>
        );
    }
  };

  return layout.sections
    .filter((section) => include?.(section) ?? true)
    .map((section) => {
      const Layout = layouts.find((l) => l.id === section.layout)?.component;
      if (!Layout) {
        return (
          <div key={section.key} className="border-b border-border p-3">
            <WarningRow
              title={`"${section.title}" can't be shown.`}
              detail={`The section layout "${section.layout}" isn't registered. Its plugin may be missing or turned off.`}
            />
          </div>
        );
      }
      return (
        <Layout
          key={section.key}
          section={section}
          clip={subject}
          values={values}
          live={live}
          renderItem={renderItem}
          enabled={enabled}
        />
      );
    });
}
