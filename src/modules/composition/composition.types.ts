import type { ProjectFormat } from "@/modules/project";

/** Named formats offered in the dialog. */
export type CompositionPresetId = "9:16" | "16:9" | "1:1" | "4:5" | "4k-16:9" | "4k-9:16";

/** A format offered in the dialog. */
export interface CompositionPreset {
  id: CompositionPresetId;
  label: string;
  hint: string;
  format: ProjectFormat;
}

/** The composition module's API for one kernel. */
export type CompositionApi = Record<string, never>;
