import { getPath } from "@/modules/element";
import { Switch } from "@/ui";
import type { SectionLayoutProps } from "../inspector.types";
import { pathPatch } from "../logic/paths";
import { InspectorSection } from "./InspectorSection";

/**
 * The built-in `section` layout: collapsible, with its group's toggle in the header. While the
 * toggle is off only the header shows.
 */
export function PanelSection({ section, values, live, renderItem }: SectionLayoutProps) {
  const header = section.header;
  const on = header === undefined || getPath(values, header) === true;
  return (
    <InspectorSection
      title={section.title}
      actions={
        header !== undefined && (
          <Switch
            label={section.title}
            checked={on}
            onChange={(checked) => live.commit(pathPatch(header, checked))}
          />
        )
      }
    >
      {on && section.items.map(renderItem)}
    </InspectorSection>
  );
}
