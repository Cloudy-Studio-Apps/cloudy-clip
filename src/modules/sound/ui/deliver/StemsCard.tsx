import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { EXPORT_FORMATS, exportRef, stemsOf } from "@/modules/export";
import { projectRef, useOpenComposition } from "@/modules/project";
import { PanelCard } from "../card";
import { soon } from "../soon";
import { CheckRow } from "./CheckRow";

/**
 * "Stems": whether the export writes each group, and Other (the tracks sent straight to Master),
 * as files of their own beside the full mix. It reads and writes the Export page's own choice
 * (`export`'s form, `stems`), so both show the same; listed are the files the composition the
 * Export page exports would get. Stems are sound only. "Match target on export" is stage 5.
 */
export function StemsCard() {
  const { form } = useModule(exportRef);
  const project = useModule(projectRef).store;
  const values = useStore(form);
  const open = useOpenComposition();
  const compositions = useStore(project.api, (s) => s.compositions);
  const tracks = useStore(project.api, (s) => s.tracks);
  const soundOnly = !EXPORT_FORMATS.find(({ id }) => id === values.format)?.picture;
  const on = values.stems && soundOnly;
  const compositionId = values.compositionId ?? open?.id;
  const plan = useMemo(
    () => (on && compositionId ? stemsOf({ compositions, tracks }, compositionId) : []),
    [on, compositionId, compositions, tracks],
  );
  return (
    <PanelCard title="Stems" className="row-span-2">
      <CheckRow
        label="Each group as a file"
        checked={on}
        disabled={!soundOnly}
        onClick={() => form.setState({ stems: !values.stems })}
        className="disabled:cursor-default disabled:opacity-50"
      />
      {on && (
        <ul className="pb-1 pl-5 font-mono text-sm text-muted-foreground">
          {plan.map(({ label }) => (
            <li key={label}>{label}</li>
          ))}
          <li>Full mix</li>
        </ul>
      )}
      {!soundOnly && (
        <p className="text-sm text-subtle-foreground">Stems need a sound-only codec.</p>
      )}
      <CheckRow label="Match target on export" checked={false} {...soon("deliver.matchTarget")} />
    </PanelCard>
  );
}
