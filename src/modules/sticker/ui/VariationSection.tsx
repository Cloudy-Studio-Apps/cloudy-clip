import { InspectorSection, type SectionLayoutProps } from "@/modules/inspector";
import { useChoosableAxes } from "./sticker.axes.hook";

/** The `sticker-variation` section: says so when a sticker has nothing to choose. */
export function VariationSection({ section, values, renderItem, foldKey }: SectionLayoutProps) {
  const axes = useChoosableAxes(values.pack, values.sticker);
  return (
    <InspectorSection title={section.title} foldKey={foldKey}>
      {axes.length === 0 ? (
        <p className="m-0 text-xs text-muted-foreground">This sticker has no variations.</p>
      ) : (
        section.items.map(renderItem)
      )}
    </InspectorSection>
  );
}
