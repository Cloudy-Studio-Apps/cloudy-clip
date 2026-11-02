import { useModule } from "@/core";
import type { Composition } from "@/modules/project";
import { SelectField } from "@/ui";
import { exportRef } from "../export.ref";
import { ExportRow } from "./ExportRow";

interface WhatToExportProps {
  compositions: readonly Composition[];
  value: string;
}

/** Which composition becomes the file. */
export function WhatToExportSection({ compositions, value }: WhatToExportProps) {
  const { form } = useModule(exportRef);
  const options = compositions.map(({ id, name }) => ({ value: id, label: name }));
  return (
    <ExportRow label="Composition">
      <SelectField
        label="Composition"
        value={value}
        options={options}
        onChange={(compositionId) => form.setState({ compositionId, from: 0, to: 0 })}
      />
    </ExportRow>
  );
}
