/**
 * Export module: the Export page and its queue, which turn a composition into a file.
 * @module export
 */
export { cancel, clearFinished, enqueue, moveUp, remove, start } from "./export.commands";
export type {
  ExportApi,
  ExportBitDepth,
  ExportCapabilities,
  ExportEffort,
  ExportFormat,
  ExportFormState,
  ExportJob,
  ExportKind,
  ExportFormatInfo,
  ExportQueueState,
  ExportRange,
  ExportSampleRate,
  ExportStatus,
  SoundSegment,
  StemPlan,
} from "./export.types";

export {
  EXPORT_BIT_DEPTHS,
  EXPORT_FORMATS,
  EXPORT_SAMPLE_RATES,
  fileRate,
  hasBitDepth,
} from "./logic/presets";
export { MIX_LABEL, stemsOf } from "./logic/stems";
export { useExportComposition } from "./ui/export.composition.hook";

/** Module definition, loaded by the app shell. */
export { exportModule } from "./export.module";
/** Handle for `require(exportRef)` / `useModule(exportRef)`. */
export { exportRef } from "./export.ref";
