import { useModule } from "@/core";
import type { Composition } from "@/modules/project";
import { SelectField, Switch } from "@/ui";
import { exportRef } from "../export.ref";
import type { StemPlan } from "../export.types";
import { MIX_LABEL } from "../logic/stems";
import { ExportRow } from "./ExportRow";

interface WhatToExportProps {
  compositions: readonly Composition[];
  value: string;
  /** Whether stems are chosen (the form's `stems`). */
  stems: boolean;
  /** Whether the format is sound only, which stems need. */
  soundOnly: boolean;
  /** The stems that will be written, when they are. */
  plan: readonly StemPlan[] | null;
}

/**
 * Which composition becomes the file, and whether each group (and Other) becomes one too. The
 * one place stems are chosen: `sound`'s Stems card shows and sets this same form value.
 */
export function WhatToExportSection({
  compositions,
  value,
  stems,
  soundOnly,
  plan,
}: WhatToExportProps) {
  const { form } = useModule(exportRef);
  const options = compositions.map(({ id, name }) => ({ value: id, label: name }));
  const files = plan && [...plan.map(({ label }) => label), MIX_LABEL].join(", ");
  return (
    <>
      <ExportRow label="Composition">
        <SelectField
          label="Composition"
          value={value}
          options={options}
          onChange={(compositionId) => form.setState({ compositionId, from: 0, to: 0 })}
        />
      </ExportRow>
      <ExportRow label="Stems">
        <Switch
          label="Stems"
          checked={stems && soundOnly}
          disabled={!soundOnly}
          onChange={(on) => form.setState({ stems: on })}
        />
      </ExportRow>
      <p className="pb-1 text-sm text-subtle-foreground">
        {!soundOnly
          ? "Stems need a sound-only format."
          : files
            ? `One file each: ${files}.`
            : "Each group as a file of its own, before Master, beside the mix."}
      </p>
    </>
  );
}
