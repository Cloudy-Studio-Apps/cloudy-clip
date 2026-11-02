import { useState } from "react";
import { Button, EmptyState, FoldSection } from "@/ui";
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

/** Softest the picture gets, in pixels, at the lowest quality. */
const MAX_BLUR = 3.5;

/** Settings on the left, the picture in the middle, the queue on the right. */
export function ExportPage() {
  const form = useExportForm();
  const { values, composition, capabilities, info } = form;
  // All open at first; lasts as long as the page, which stays mounted.
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const fold = (title: string) => ({
    title,
    open: !closed[title],
    onToggle: () => setClosed((now) => ({ ...now, [title]: !now[title] })),
  });

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
    <div className="grid h-full grid-cols-[392px_minmax(0,1fr)_minmax(280px,21vw)]">
      <div className="flex min-h-0 flex-col border-r border-border-strong bg-surface">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FoldSection {...fold("Save to")}>
            <SaveToSection name={form.name} folder={values.folder} />
          </FoldSection>
          <FoldSection {...fold("What to export")}>
            <WhatToExportSection compositions={form.compositions} value={composition.id} />
          </FoldSection>
          <FoldSection {...fold("Kind of export")}>
            <KindTiles value={values.kind} picture={form.picture} sizeAt={form.sizeAt} />
          </FoldSection>
          {info.quality && (
            <FoldSection {...fold("Quality")}>
              <QualitySlider value={values.quality} />
            </FoldSection>
          )}
          <FoldSection {...fold("Settings")}>
            <SettingsSection
              values={values}
              format={composition.format}
              capabilities={capabilities}
            >
              <RangeField
                whole={values.whole}
                from={form.from}
                to={form.to}
                duration={composition.duration}
              />
            </SettingsSection>
          </FoldSection>
          <FoldSection {...fold("When saving")}>
            <WhenSavingSection ifExists={values.ifExists} reveal={values.reveal} />
          </FoldSection>
        </div>
        <div className="shrink-0 border-t border-border-strong px-3 py-2.5">
          <Button
            variant="primary"
            className="h-[34px] w-full text-[14.5px]"
            disabled={!form.ready}
            onClick={() => void form.add()}
          >
            Add to queue
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col bg-stage">
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3.5">
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
        </div>
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
