import { InspectorSection, type SectionLayoutProps } from "@/modules/inspector";
import { useChoosableAxes } from "./sticker.axes.hook";

/** The `sticker-variation` section: left out for a sticker with nothing to choose. */
export function VariationSection({ section, values, renderItem }: SectionLayoutProps) {
  const axes = useChoosableAxes(values.pack, values.sticker);
  if (axes.length === 0) return null;
  return <InspectorSection title={section.title}>{section.items.map(renderItem)}</InspectorSection>;
}
