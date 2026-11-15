import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useModule } from "@/core";
import type { ProjectFormat } from "@/modules/project";
import { SelectField, Switch } from "@/ui";
import { exportRef } from "../export.ref";
import {
  EXPORT_BIT_DEPTHS,
  EXPORT_FORMATS,
  EXPORT_SAMPLE_RATES,
  formatInfo,
  hasBitDepth,
} from "../logic/presets";
import type {
  ExportCapabilities,
  ExportEffort,
  ExportFormat,
  ExportBitDepth,
  ExportFormState,
  ExportSampleRate,
} from "../export.types";
import { ExportRow } from "./ExportRow";

const EFFORTS: readonly { value: ExportEffort; label: string }[] = [
  { value: "fast", label: "Fast" },
  { value: "balanced", label: "Balanced" },
  { value: "small", label: "Slow, smaller file" },
];

interface SettingsProps {
  values: ExportFormState;
  format: ProjectFormat;
  capabilities: ExportCapabilities | null;
  /** The range field, which sits among these. */
  children: ReactNode;
}

/** Comes from the composition, so it can't be changed here. */
function Locked({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-[26px] items-center justify-between border-b border-border px-1 font-mono text-[13px] text-muted-foreground">
      {children}
      <Lock className="size-[13px] text-subtle-foreground" />
    </span>
  );
}

/** Size, rate, format and how the file is made. */
export function SettingsSection({ values, format, capabilities, children }: SettingsProps) {
  const { form } = useModule(exportRef);
  const info = formatInfo(values.format);
  const available = capabilities?.formats;
  const options = EXPORT_FORMATS.filter(({ id }) => !available || available.includes(id)).map(
    ({ id, label }) => ({ value: id, label }),
  );
  const card = values.format === "h265" ? capabilities?.h265Card : capabilities?.h264Card;
  const usesCard = values.format === "h264" || values.format === "h265";
  return (
    <>
      <ExportRow label="Size">
        <Locked>
          {format.width} × {format.height}
        </Locked>
      </ExportRow>
      <ExportRow label="Frame rate">
        <Locked>{format.fps} fps</Locked>
      </ExportRow>
      <ExportRow label="Format">
        <SelectField
          label="Format"
          value={values.format}
          options={options}
          onChange={(value) => form.setState({ format: value as ExportFormat })}
        />
      </ExportRow>
      {children}
      {!info.picture && (
        <ExportRow label="Sample rate">
          {values.format === "opus" ? (
            <Locked>48 kHz</Locked>
          ) : (
            <SelectField
              label="Sample rate"
              value={String(values.sampleRate)}
              options={EXPORT_SAMPLE_RATES.map(({ value, label }) => ({
                value: String(value),
                label,
              }))}
              onChange={(value) => form.setState({ sampleRate: Number(value) as ExportSampleRate })}
            />
          )}
        </ExportRow>
      )}
      {hasBitDepth(values.format) && (
        <ExportRow label="Bit depth">
          <SelectField
            label="Bit depth"
            value={String(values.bitDepth)}
            options={EXPORT_BIT_DEPTHS.map(({ value, label }) => ({
              value: String(value),
              label,
            }))}
            onChange={(value) => form.setState({ bitDepth: Number(value) as ExportBitDepth })}
          />
        </ExportRow>
      )}
      {info.picture && values.format !== "prores" && values.format !== "gif" && (
        <ExportRow label="Encoding">
          <SelectField
            label="Encoding"
            value={values.effort}
            options={EFFORTS}
            onChange={(value) => form.setState({ effort: value as ExportEffort })}
          />
        </ExportRow>
      )}
      {info.sound && info.picture && (
        <ExportRow label="Include sound">
          <Switch
            label="Include sound"
            checked={values.sound}
            onChange={(sound) => form.setState({ sound })}
          />
        </ExportRow>
      )}
      {usesCard && card && (
        <ExportRow label="Use the graphics card">
          <Switch
            label="Use the graphics card"
            checked={values.hardware}
            onChange={(hardware) => form.setState({ hardware })}
          />
        </ExportRow>
      )}
    </>
  );
}
