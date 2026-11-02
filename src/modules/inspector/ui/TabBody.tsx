import type { InspectorContext, PanelEntry } from "../inspector.types";
import { ClipSection } from "./ClipSection";
import { InspectorSection } from "./InspectorSection";

interface TabBodyProps {
  context: InspectorContext;
  entries: readonly PanelEntry[];
}

/** The sections of the open tab, whichever module they came from. */
export function TabBody({ context, entries }: TabBodyProps) {
  return entries.map((entry) => {
    if (entry.type === "layout") {
      return (
        <ClipSection
          key={entry.key}
          member={entry.member}
          source={entry.source}
          section={entry.section}
        />
      );
    }
    const { item } = entry;
    const Body = item.component;
    if (item.bare) return <Body key={entry.key} context={context} />;
    return (
      <InspectorSection key={entry.key} title={item.title} foldKey={item.id}>
        <Body context={context} />
      </InspectorSection>
    );
  });
}
