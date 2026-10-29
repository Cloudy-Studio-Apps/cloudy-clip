import type { ComponentType } from "react";
import type { Clip, Track } from "@/modules/project";

/** The inspector module's API. Empty for now: it only contributes its panel. */
export type InspectorApi = Record<string, never>;

/**
 * A group of fields in the inspector's clip view, contributed by a module with
 * `ctx.contribute(inspectorSections, …)`. The inspector wraps it in a collapsible section titled
 * `title`; the component renders only the body.
 */
export interface InspectorClipSection {
  /** Unique id, `<module>.<name>`. */
  id: string;
  /** The section's heading. */
  title: string;
  /** Sort position, ascending. Text sections use 10-60, transform 100. */
  order: number;
  /** Whether the section shows for this clip (on this track). */
  appliesTo(clip: Clip, track: Track): boolean;
  /** The section's body. */
  component: ComponentType<{ clip: Clip }>;
}
