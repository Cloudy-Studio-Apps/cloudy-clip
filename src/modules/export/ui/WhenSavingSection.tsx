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
  matchTarget: boolean;
  /** Whether the export has sound to match. */
  sound: boolean;
}

/**
 * What happens around the file, and "Match the delivery target": the mix in the file brought to
 * the composition's delivery target, the project left as it is. Shown when a module can match
 * (`sound`), off while the export has no sound.
 */
export function WhenSavingSection({ ifExists, reveal, matchTarget, sound }: WhenSavingProps) {
  const { form, canMatchTarget } = useModule(exportRef);
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
      {canMatchTarget() && (
        <ExportRow label="Match the delivery target">
          <Switch
            label="Match the delivery target"
            checked={matchTarget && sound}
            disabled={!sound}
            onChange={(value) => form.setState({ matchTarget: value })}
          />
        </ExportRow>
      )}
    </>
  );
}
