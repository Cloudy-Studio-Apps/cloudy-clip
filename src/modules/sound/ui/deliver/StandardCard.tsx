import { useKernel } from "@/core";
import type { StandardId } from "@/modules/project";
import { NumberField, SelectField } from "@/ui";
import { STANDARDS, standardOf } from "../../logic/standards";
import { setDelivery } from "../../sound.delivery.commands";
import { PanelCard, PanelRow } from "../card";
import { report } from "@/core";
import { AnalysisResult } from "./AnalysisResult";
import { AnalyzeRow } from "./AnalyzeRow";
import { useDeliver } from "./deliver.hook";
import { MatchRow } from "./MatchRow";

/**
 * "Delivery standard": the platform preset, its loudness target and its peak limit, all
 * `sound.setDelivery` (one undo step each); changing a figure by hand makes the preset Custom.
 * Under them says honestly where the figures come from (a published page, a common convention, or
 * your own), then "Analyze whole mix" with its result and "Match target".
 */
export function StandardCard() {
  const { bus } = useKernel();
  const view = useDeliver();
  const { compositionId, delivery } = view;
  const standard = standardOf(delivery.standard);
  const change = (patch: { standard?: StandardId; loudnessLufs?: number; peakDbtp?: number }) =>
    void bus.run(setDelivery, { ...(compositionId && { compositionId }), ...patch }).then(report);
  return (
    <PanelCard title="Delivery standard" className="row-span-2">
      <PanelRow label="Preset">
        <SelectField
          label="Delivery standard"
          value={delivery.standard}
          disabled={!compositionId}
          options={STANDARDS.map(({ id, name }) => ({ value: id, label: name }))}
          onChange={(value) => change({ standard: value as StandardId })}
        />
      </PanelRow>
      <PanelRow label="Loudness">
        <NumberField
          label="Target loudness (LUFS)"
          className="w-24"
          value={delivery.loudnessLufs}
          min={-40}
          max={-5}
          step={0.5}
          unit="LUFS"
          disabled={!compositionId}
          onChange={(loudnessLufs) => change({ loudnessLufs })}
        />
      </PanelRow>
      <PanelRow label="Peak limit">
        <NumberField
          label="Peak limit (dBTP)"
          className="w-24"
          value={delivery.peakDbtp}
          min={-20}
          max={0}
          step={0.5}
          unit="dBTP"
          disabled={!compositionId}
          onChange={(peakDbtp) => change({ peakDbtp })}
        />
      </PanelRow>
      <p className="text-sm text-subtle-foreground">
        {standard.id === "custom"
          ? "Your own figures."
          : standard.published
            ? `Figures from ${standard.name}'s published guidance.`
            : `A common convention: ${standard.name} publishes no official figure.`}
      </p>
      <AnalyzeRow view={view} />
      <AnalysisResult view={view} />
      <MatchRow view={view} />
    </PanelCard>
  );
}
