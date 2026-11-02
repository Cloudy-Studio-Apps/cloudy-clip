import { Button, EmptyState } from "@/ui";
import { ExportFacts } from "./ExportFacts";
import { useExportForm } from "./export.form.hook";
import { ExportStage } from "./ExportStage";
import { ExportWarning } from "./ExportWarning";
import { KindTiles } from "./KindTiles";
import { QualitySlider } from "./QualitySlider";
import { QueuePanel } from "./QueuePanel";
import { RangeField } from "./RangeField";
import { SaveToSection } from "./SaveToSection";
import { SettingsSection } from "./SettingsSection";
import { WhatToExportSection } from "./WhatToExportSection";
import { WhenSavingSection } from "./WhenSavingSection";
import { ExportHeading } from "./ExportHeading";

/** Softest the picture gets, in pixels, at the lowest quality. */
const MAX_BLUR = 3.5;

/** Settings on the left, the picture in the middle, the queue on the right. */
export function ExportPage() {
  const form = useExportForm();
  const { values, composition, capabilities, info } = form;

  if (!composition) {
    return (
      <div className="flex h-full p-6">
        <EmptyState title="Nothing to export yet">
          Make a composition in the editor first.
        </EmptyState>
      </div>
    );
  }
  const missingFfmpeg = capabilities !== null && !capabilities.ffmpeg;
  return (
    <div className="grid h-full grid-cols-[minmax(340px,26vw)_minmax(0,1fr)_minmax(280px,21vw)]">
      <div className="flex min-h-0 flex-col gap-3.5 overflow-y-auto border-r border-border bg-surface p-3.5">
        <SaveToSection name={form.name} folder={values.folder} />
        <WhatToExportSection compositions={form.compositions} value={composition.id} />
        <section className="flex flex-col gap-2">
          <ExportHeading>Kind of export</ExportHeading>
          <KindTiles value={values.kind} picture={form.picture} sizeAt={form.sizeAt} />
        </section>
        {info.quality && <QualitySlider value={values.quality} />}
        <SettingsSection values={values} format={composition.format} capabilities={capabilities}>
          <RangeField
            whole={values.whole}
            from={form.from}
            to={form.to}
            duration={composition.duration}
          />
        </SettingsSection>
        <WhenSavingSection ifExists={values.ifExists} reveal={values.reveal} />
        <Button
          variant="primary"
          className="mt-auto shrink-0 justify-center"
          disabled={!form.ready}
          onClick={() => void form.add()}
        >
          Add to queue
        </Button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col gap-3 p-3.5">
        <ExportStage
          picture={form.picture}
          hasPicture={info.picture}
          blur={info.quality ? Math.max(0, ((60 - values.quality) / 50) * MAX_BLUR) : 0}
        />
        {missingFfmpeg && (
          <ExportWarning
            blocking
            message="Exporting needs FFmpeg. On Windows run: winget install Gyan.FFmpeg. On Linux install the ffmpeg package. Then restart Cloudy Clip."
          />
        )}
        {form.blocker && <ExportWarning blocking message={form.blocker} />}
        {form.note && !form.blocker && <ExportWarning blocking={false} message={form.note} />}
        <ExportFacts
          bytes={form.bytes}
          seconds={form.seconds}
          length={form.length / 1_000_000}
          free={form.free}
        />
      </div>
      <QueuePanel />
    </div>
  );
}
