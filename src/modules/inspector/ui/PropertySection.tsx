import { useMemo, type ReactNode } from "react";
import { usePoint } from "@/core";
import type { LayoutSource, ResolvedItem, ResolvedSection } from "@/modules/element";
import { sectionLayouts } from "../inspector.points";
import type { PanelSubject, PropsLive, SectionReset } from "../inspector.types";
import { isEnabled } from "../logic/conditions";
import { differs, itemPaths, rowSpecs, sectionPaths } from "../logic/reset";
import { FieldActions } from "./FieldActions";
import { FieldLabel } from "./controls/FieldLabel";
import { FieldInlineContext } from "./controls/field.context";
import { FieldItem } from "./FieldItem";
import { SubSection } from "./SubSection";
import { WarningRow } from "./WarningRow";

interface PropertySectionProps {
  subject: PanelSubject;
  source: LayoutSource;
  section: ResolvedSection;
  values: Record<string, unknown>;
  /** The subject's values when it stores none, when known. */
  defaults?: Record<string, unknown>;
  live: PropsLive;
  /** Draws a command item; without it, commands show as unavailable. */
  renderCommand?(item: Extract<ResolvedItem, { type: "command" }>, index: number): ReactNode;
}

/** One section of a panel, drawn by its section layout, each item by its control. */
export function PropertySection({
  subject,
  source,
  section,
  values,
  defaults,
  live,
  renderCommand,
}: PropertySectionProps) {
  const layouts = usePoint(sectionLayouts);
  const fields = source.fields;
  const enabled = (path: string) => {
    const spec = fields.get(path);
    return spec !== undefined && isEnabled(spec, values);
  };
  const paths = useMemo(() => sectionPaths(section, fields), [section, fields]);

  const draw = (item: ResolvedItem, index: number, inRow: boolean): ReactNode => {
    switch (item.type) {
      case "field":
        return (
          <FieldItem
            key={item.path}
            item={item}
            clip={subject}
            fields={fields}
            values={values}
            defaults={defaults}
            live={live}
            inRow={inRow}
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
      case "row": {
        const rowPaths = itemPaths(item, fields);
        return (
          <div key={index} className="flex min-w-0 items-center gap-1">
            {item.label !== undefined && <FieldLabel>{item.label}</FieldLabel>}
            <FieldInlineContext.Provider value={item.label !== undefined}>
              <div className="ml-0.5 flex min-w-0 flex-1 items-center gap-1.5">
                {item.items.map((inner, i) => draw(inner, i, true))}
              </div>
            </FieldInlineContext.Provider>
            <FieldActions
              specs={rowSpecs(item, fields)}
              paths={rowPaths}
              values={values}
              defaults={defaults}
              live={live}
              disabled={!rowPaths.some(enabled)}
            />
          </div>
        );
      }
      case "sub":
        return (
          <SubSection key={index} item={item} values={values} live={live} enabled={enabled}>
            {item.items.map((inner, i) => draw(inner, i, false))}
          </SubSection>
        );
    }
  };

  const Layout = layouts.find((l) => l.id === section.layout)?.component;
  if (!Layout) {
    return (
      <div className="border-b border-border p-3">
        <WarningRow
          title={`"${section.title}" can't be shown.`}
          detail={`The section layout "${section.layout}" isn't registered. Its plugin may be missing or turned off.`}
        />
      </div>
    );
  }
  const reset: SectionReset | undefined =
    live.reset && defaults && paths.length > 0
      ? {
          changed: differs(paths.filter(enabled), values, defaults),
          run: () => live.reset?.(paths.filter(enabled)),
        }
      : undefined;
  return (
    <div className="contents" data-collab-target={`inspector:${section.key}`}>
      <Layout
        section={section}
        clip={subject}
        values={values}
        live={live}
        renderItem={(item, index) => draw(item, index, false)}
        enabled={enabled}
        foldKey={`${subject.kind}:${section.key}`}
        reset={reset}
      />
    </div>
  );
}
