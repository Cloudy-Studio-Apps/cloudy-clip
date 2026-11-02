import { useModule } from "@/core";
import { SelectField, Switch } from "@/ui";
import { exportRef } from "../export.ref";
import type { ExportFormState } from "../export.types";
import { ExportRow } from "./ExportRow";

const IF_EXISTS = [
  { value: "number", label: "Add a number" },
  { value: "ask", label: "Ask me" },
  { value: "replace", label: "Replace it" },
];

interface WhenSavingProps {
  ifExists: ExportFormState["ifExists"];
  reveal: boolean;
}

/** What happens around the file. */
export function WhenSavingSection({ ifExists, reveal }: WhenSavingProps) {
  const { form } = useModule(exportRef);
  return (
    <>
      <ExportRow label="If the file exists">
        <SelectField
          label="If the file exists"
          value={ifExists}
          options={IF_EXISTS}
          onChange={(value) => form.setState({ ifExists: value as ExportFormState["ifExists"] })}
        />
      </ExportRow>
      <ExportRow label="Open the folder after">
        <Switch
          label="Open the folder when finished"
          checked={reveal}
          onChange={(value) => form.setState({ reveal: value })}
        />
      </ExportRow>
    </>
  );
}
