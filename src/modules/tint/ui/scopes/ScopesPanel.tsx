import { ChartArea, ChartColumn, Activity } from "lucide-react";
import { SegmentedControl } from "@/ui";
import type { ScopeKind } from "../../tint.types";
import { HeaderGap } from "../HeaderGap";
import { PanelNote } from "../PanelNote";
import { TintPanel } from "../TintPanel";
import { useTintView } from "../view.hook";
import { useTintSet } from "../view.set.hook";
import { ScopeCanvas } from "./ScopeCanvas";

/** Parade, waveform or histogram, with the vectorscope always beside it. */
export function ScopesPanel() {
  const scope = useTintView((v) => v.scope);
  const set = useTintSet();
  return (
    <TintPanel
      header={
        <>
          Scopes
          <SegmentedControl<ScopeKind>
            label="Scope"
            className="ml-3"
            value={scope}
            onChange={(next) => set({ scope: next })}
            options={[
              {
                value: "parade",
                label: "Parade",
                icon: ChartColumn,
                hint: "Red, green and blue side by side. Level lines mean neutral.",
              },
              {
                value: "wave",
                label: "Waveform",
                icon: Activity,
                hint: "Brightness across the picture: bottom black, top white.",
              },
              {
                value: "hist",
                label: "Histogram",
                icon: ChartArea,
                hint: "How many pixels sit at each brightness.",
              },
            ]}
          />
          <HeaderGap />
          <PanelNote>Vectorscope · gold line is skin</PanelNote>
        </>
      }
    >
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-2 p-2">
        <ScopeCanvas kind={scope} />
        <ScopeCanvas kind="vector" />
      </div>
    </TintPanel>
  );
}
