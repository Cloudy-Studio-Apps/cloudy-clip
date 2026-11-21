import { useStore } from "zustand";
import { useModule } from "@/core";
import { InspectorSection, useClipAtPlayhead, type InspectorContext } from "@/modules/inspector";
import { orderedMasks } from "@/modules/project";
import { maskRef } from "../mask.ref";
import { useMaskEdit } from "./mask.edit.hook";
import { MaskFields } from "./MaskFields";
import { MaskPresets } from "./MaskPresets";
import { MaskRow } from "./MaskRow";

/** The Mask tab's first section: presets, the list of masks and the selected mask's fields. */
export function MaskSection({ context }: { context: InspectorContext }) {
  const { clip } = context;
  const edit = useMaskEdit(clip.id);
  const { ui } = useModule(maskRef);
  const selectedId = useStore(ui, (s) => s.selectedMaskId);
  const now = useClipAtPlayhead(clip);
  const masks = orderedMasks(clip);
  // With several clips selected the list would be ambiguous: presets only.
  const several = edit.targets().length > 1;
  const selected = masks.find((m) => m.id === selectedId) ?? masks[0];

  return (
    <InspectorSection title="Mask">
      <MaskPresets clip={clip} edit={edit} />
      {!several && masks.length > 0 && (
        <div className="flex min-w-0 flex-col gap-0.5">
          {masks.map((mask, index) => (
            <MaskRow
              key={mask.id}
              clipId={clip.id}
              mask={mask}
              index={index}
              count={masks.length}
              selected={mask.id === selected?.id}
              edit={edit}
              onSelect={() => ui.setState({ selectedMaskId: mask.id, selectedPointId: null })}
            />
          ))}
        </div>
      )}
      {!several && selected && now.masks?.[selected.id] && (
        <MaskFields clip={clip} mask={now.masks[selected.id]!} edit={edit} />
      )}
    </InspectorSection>
  );
}
