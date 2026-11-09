import { useStore } from "zustand";
import { useModule } from "@/core";
import {
  EXPORT_BIT_DEPTHS,
  EXPORT_FORMATS,
  EXPORT_SAMPLE_RATES,
  exportRef,
  fileRate,
  hasBitDepth,
} from "@/modules/export";
import type { ExportBitDepth, ExportFormat, ExportSampleRate } from "@/modules/export";
import { SelectField } from "@/ui";
import { PanelCard, PanelRow, PanelValue } from "../card";

/**
 * "Audio format": the codec, sample rate and bit depth of the exported sound. They are the Export
 * page's own settings (its form), so what is chosen here is what the Export page shows.
 */
export function FormatCard() {
  const { form, capabilities } = useModule(exportRef);
  const values = useStore(form);
  const available = useStore(capabilities, (state) => state.value?.formats);
  const options = EXPORT_FORMATS.filter(({ id }) => !available || available.includes(id)).map(
    ({ id, short }) => ({ value: id, label: short }),
  );
  const rate = fileRate(values.format, values.sampleRate);
  // A format with a picture, and Opus, can only be 48 kHz.
  const rateFixed = fileRate(values.format, 44100) !== 44100;
  return (
    <PanelCard title="Audio format" className="row-span-2">
      <PanelRow label="Codec">
        <SelectField
          label="Codec"
          value={values.format}
          options={options}
          onChange={(value) => form.setState({ format: value as ExportFormat })}
        />
      </PanelRow>
      <PanelRow label="Sample rate">
        <SelectField
          label="Sample rate"
          value={String(rate)}
          disabled={rateFixed}
          options={EXPORT_SAMPLE_RATES.map(({ value, label }) => ({
            value: String(value),
            label,
          }))}
          onChange={(value) => form.setState({ sampleRate: Number(value) as ExportSampleRate })}
        />
      </PanelRow>
      {hasBitDepth(values.format) && (
        <PanelRow label="Bit depth">
          <SelectField
            label="Bit depth"
            value={String(values.bitDepth)}
            options={EXPORT_BIT_DEPTHS.map(({ value, label }) => ({
              value: String(value),
              label,
            }))}
            onChange={(value) => form.setState({ bitDepth: Number(value) as ExportBitDepth })}
          />
        </PanelRow>
      )}
      <PanelValue label="Channels" value="Stereo" />
    </PanelCard>
  );
}
