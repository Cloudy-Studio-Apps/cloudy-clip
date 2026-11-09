import { useStore } from "zustand";
import { useModule } from "@/core";
import { EXPORT_FORMATS, MIX_LABEL, exportRef, useExportComposition } from "@/modules/export";
import { PanelCard } from "../card";
import { soon } from "../soon";
import { CheckRow } from "./CheckRow";

/**
 * "Stems": whether the export writes each group, and Other (the tracks sent straight to Master),
 * as files of their own beside the mix. It reads and writes the Export page's own choice
 * (`export`'s form, `stems`), so both show the same; listed are the files the composition the
 * Export page exports would get. With no group there is nothing to split, and the control says so. Stems are sound only. "Match target on export" is stage 5.
 */
export function StemsCard() {
  const { form } = useModule(exportRef);
  const values = useStore(form);
  const { stems, groups } = useExportComposition();
  const soundOnly = !EXPORT_FORMATS.find(({ id }) => id === values.format)?.picture;
  const on = values.stems && soundOnly && groups;
  return (
    <PanelCard title="Stems" className="row-span-2">
      <CheckRow
        label="Each group as a file"
        checked={on}
        disabled={!soundOnly || !groups}
        onClick={() => form.setState({ stems: !values.stems })}
        className="disabled:cursor-default disabled:opacity-50"
      />
      {on && (
        <ul className="pb-1 pl-5 font-mono text-sm text-muted-foreground">
          {stems.map(({ label }) => (
            <li key={label}>{label}</li>
          ))}
          <li>{MIX_LABEL}</li>
        </ul>
      )}
      {!soundOnly && (
        <p className="text-sm text-subtle-foreground">Stems need a sound-only codec.</p>
      )}
      {soundOnly && !groups && (
        <p className="text-sm text-subtle-foreground">Add a group to export stems.</p>
      )}
      <CheckRow label="Match target on export" checked={false} {...soon("deliver.matchTarget")} />
    </PanelCard>
  );
}
