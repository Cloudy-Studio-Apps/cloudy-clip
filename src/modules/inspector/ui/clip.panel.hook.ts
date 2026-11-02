import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule, usePoint } from "@/core";
import { elementRef, elements as elementPoint, propTypes } from "@/modules/element";
import { projectRef } from "@/modules/project";
import { inspectorSections, inspectorTabs } from "../inspector.points";
import { inspectorRef } from "../inspector.ref";
import type { ClipPanel, InspectorContext, InspectorMember, PanelEntry } from "../inspector.types";
import { panelLayout } from "../logic/layout";
import { pickTab, sectionTab, tabStates } from "../logic/tabs";
import { useWarnOnce } from "./panel.warn.hook";

/**
 * What a clip's panel shows: every section of the clip and its linked partner, from their elements
 * and from `inspectorSections`, grouped by tab. A tab is available when a section lands in it.
 */
export function useClipPanel(context: InspectorContext): ClipPanel {
  const elements = useModule(elementRef);
  const project = useModule(projectRef).store;
  const view = useModule(inspectorRef).view;
  const tabs = usePoint(inspectorTabs);
  const contributed = usePoint(inspectorSections);
  const types = usePoint(propTypes);
  // Re-render when elements are registered or removed (a plugin loaded after the panel opened).
  const registered = usePoint(elementPoint);
  // Contributed sections may depend on any of these (a clip's junctions).
  const junctions = useStore(project.api, (s) => s.junctions);
  const remembered = useStore(view.store, (s) => s.tabs[context.clip.kind]);

  const kind = context.clip.kind;
  const partnerKind = context.partner?.clip.kind;
  const layouts = useMemo(() => {
    const of = (name: string | undefined) => {
      const source = name === undefined ? undefined : elements.get(name);
      return source && { source, layout: panelLayout(source, types) };
    };
    return { own: of(kind), partner: of(partnerKind) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `registered` invalidates the lookup
  }, [elements, kind, partnerKind, types, registered]);

  const { entries, unknown } = useMemo(() => {
    const grouped = new Map<string, PanelEntry[]>();
    const unknownTabs = new Set<string>();
    const put = (named: string | undefined, entry: PanelEntry) => {
      const tab = sectionTab(named, tabs);
      if (tab === undefined) return;
      if (named !== undefined && tab !== named) unknownTabs.add(named);
      grouped.set(tab, [...(grouped.get(tab) ?? []), entry]);
    };
    const addLayout = (member: InspectorMember, found: typeof layouts.own) => {
      if (!found) return;
      for (const section of found.layout.sections) {
        const group = found.source.groups.find((g) => g.id === section.key);
        if (group?.appliesTo && !group.appliesTo(member.clip, member.track)) continue;
        put(section.tab, {
          type: "layout",
          key: `${member.clip.id}:${section.key}`,
          order: section.order,
          member,
          source: found.source,
          section,
        });
      }
    };
    addLayout(context, layouts.own);
    if (context.partner) addLayout(context.partner, layouts.partner);
    const state = project.getState();
    for (const item of contributed) {
      if (item.appliesTo && !item.appliesTo(context, state)) continue;
      put(item.tab, { type: "section", key: item.id, order: item.order, item });
    }
    return { entries: grouped, unknown: [...unknownTabs] };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `junctions` changes what sections apply
  }, [context, contributed, junctions, layouts, project, tabs]);

  const issues = [...(layouts.own?.layout.issues ?? []), ...(layouts.partner?.layout.issues ?? [])];
  useWarnOnce(issues.map((i) => i.message).join("\n") || null);
  useWarnOnce(
    unknown.length > 0
      ? `inspector: no tab "${unknown.join('", "')}" is registered (is its module loaded?)`
      : null,
  );

  const states = tabStates(tabs, new Set(entries.keys()));
  const active = pickTab(states, remembered);
  const shown = active === undefined ? [] : (entries.get(active) ?? []);
  return { tabs: states, active, entries: [...shown].sort((a, b) => a.order - b.order) };
}
