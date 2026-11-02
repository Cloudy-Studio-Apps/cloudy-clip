import { getPath } from "@/modules/element";
import { Switch } from "@/ui";
import type { SectionLayoutProps } from "../inspector.types";
import { pathPatch } from "../logic/paths";
import { InspectorSection } from "./InspectorSection";
import { ResetButton } from "./ResetButton";

/**
 * The built-in `section` layout: a band with its group's toggle on the left and a reset on the
 * right. While the toggle is off only the band shows.
 */
export function PanelSection({
  section,
  values,
  live,
  renderItem,
  enabled,
  foldKey,
  reset,
}: SectionLayoutProps) {
  const header = section.header;
  const on = header === undefined || getPath(values, header) === true;
  return (
    <InspectorSection
      title={section.title}
      foldKey={foldKey}
      leading={
        header !== undefined && (
          <Switch
            label={section.title}
            checked={on}
            disabled={!enabled(header)}
            onChange={(checked) => live.commit(pathPatch(header, checked))}
          />
        )
      }
      actions={
        reset && (
          <ResetButton
            label={`Reset ${section.title.toLowerCase()}`}
            changed={reset.changed}
            onClick={reset.run}
          />
        )
      }
    >
      {on && section.items.map(renderItem)}
    </InspectorSection>
  );
}
