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

/** How a field edits a clip's values: live while dragging, one command on release. */
export interface PropsLive {
  /** Shows `patch` in the preview (merged over what was input before), without touching the project. */
  input(patch: Record<string, unknown>): void;
  /** Commits the input so far plus `patch` as one `element.setProps` (skipped when nothing changes), then clears the preview. */
  commit(patch: Record<string, unknown>): void;
}

/** What `createPropsLive` needs: the preview, the clip's current values and the command. */
export interface PropsLiveDeps {
  /** Shows a live patch (null clears it). */
  preview(patch: Record<string, unknown> | null): void;
  /** The clip's resolved values now, or null when it is gone. */
  read(): Record<string, unknown> | null;
  /** Runs the command with the whole patch. */
  commit(patch: Record<string, unknown>): Promise<unknown>;
}
