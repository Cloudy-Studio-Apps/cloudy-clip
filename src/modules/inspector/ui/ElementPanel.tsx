import { useMemo, type ReactNode } from "react";
import { useStore } from "zustand";
import { useModule, usePoint } from "@/core";
import {
  defaultControl,
  elementRef,
  elements as elementPoint,
  propTypes,
  resolveLayout,
  type ResolvedItem,
} from "@/modules/element";
import { projectRef, type Clip, type Track } from "@/modules/project";
import { sectionLayouts } from "../inspector.points";
import { isEnabled } from "../logic/conditions";
import { CommandItem } from "./CommandItem";
import { FieldItem } from "./FieldItem";
import { useWarnOnce } from "./panel.warn.hook";
import { usePropsLive } from "./props.live.hook";
import { SubSection } from "./SubSection";
import { WarningRow } from "./WarningRow";

/**
 * The sections of a clip's element, generated from its layout (or its properties): each drawn by
 * its section layout, each item by its control. Values are resolved once per clip change; drags
 * only redraw the preview.
 */
export function ElementPanel({ clip, track }: { clip: Clip; track: Track }) {
  const elements = useModule(elementRef);
  const format = useStore(useModule(projectRef).store.api, (s) => s.format);
  const types = usePoint(propTypes);
  const layouts = usePoint(sectionLayouts);
  // Re-render when elements are registered or removed (a plugin loaded after the panel opened).
  const registered = usePoint(elementPoint);
  const live = usePropsLive(clip);
  const resolved = useMemo(
    () => elements.get(clip.kind),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `registered` invalidates the lookup
    [elements, clip.kind, registered],
  );
  const values = useMemo(() => elements.resolve(clip, format), [elements, clip, format]);
  const layout = useMemo(
    () =>
      resolved
        ? resolveLayout(resolved, (_path, spec) =>
            defaultControl(spec, spec.type ? types.find((t) => t.name === spec.type) : undefined),
          )
        : null,
    [resolved, types],
  );
  const issues = layout?.issues.map((i) => i.message).join("\n") ?? "";
  useWarnOnce(issues || null);
  useWarnOnce(resolved ? null : `no element is registered for "${clip.kind}" clips`);
  if (!resolved || !layout) {
    return (
      <div className="p-3">
        <WarningRow
          title="These clips can't be edited."
          detail={`No module provides "${clip.kind}" clips. Its plugin may be missing or turned off.`}
        />
      </div>
    );
  }

  const enabled = (path: string) => {
    const spec = resolved.fields.get(path);
    return spec !== undefined && isEnabled(spec, values);
  };
  const renderItem = (item: ResolvedItem, index: number): ReactNode => {
    switch (item.type) {
      case "field":
        return <FieldItem key={item.path} item={item} clip={clip} values={values} live={live} />;
      case "command":
        return <CommandItem key={`${item.id}:${index}`} item={item} clip={clip} />;
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
    .filter((section) => {
      const group = resolved.groups.find((g) => g.id === section.key);
      return !group?.appliesTo || group.appliesTo(clip, track);
    })
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
          clip={clip}
          values={values}
          live={live}
          renderItem={renderItem}
          enabled={enabled}
        />
      );
    });
}
