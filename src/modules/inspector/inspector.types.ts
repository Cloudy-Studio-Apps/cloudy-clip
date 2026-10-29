import type { ComponentType, ReactNode } from "react";
import type { z } from "zod";
import type { PropSpec, ResolvedItem, ResolvedSection } from "@/modules/element";
import type { StoreApi } from "zustand/vanilla";
import type { Clip } from "@/modules/project";

/** The colors picked lately, shared by every color field of the inspector. Not in history. */
export interface RecentColors {
  /** Newest first, at most 12. Read with `useStore(recents.store, selector)`. */
  readonly store: StoreApi<{ colors: string[] }>;
  /** Remembers a color (and saves the list). */
  push(color: string): void;
}

/** The inspector module's API: the recent colors every color field shares. */
export interface InspectorApi {
  readonly recents: RecentColors;
}

/** What a field control gets: the value at its path and a way to change it. */
export interface FieldControlProps {
  clip: Clip;
  /** Dotted path of the value (`outline.width`). */
  path: string;
  spec: PropSpec;
  value: unknown;
  /** Every resolved value of the clip, for siblings (a color's opacity). */
  values: Record<string, unknown>;
  label: string;
  disabled: boolean;
  /** Patches are whole-clip patches: build them with the path (`{ outline: { width } }`). */
  live: PropsLive;
}

/** What a command control gets: the command to run on the clip and the one field it may draw. */
export interface CommandControlProps {
  clipIds: string[];
  commandId: string;
  /** The command's one input besides `clipIds`, when it has one. */
  field?: { name: string; schema: z.ZodType };
  label: string;
  icon?: string;
  /** Runs the command with `clipIds` plus this input. */
  run(input: Record<string, unknown>): void;
}

/** A control the inspector can draw, by id: for a value (`for: "field"`) or for a command. */
export type PropertyControl =
  | { id: string; for: "field"; component: ComponentType<FieldControlProps> }
  | { id: string; for: "command"; component: ComponentType<CommandControlProps> };

/** What a section layout gets: the resolved section and a way to draw its items. */
export interface SectionLayoutProps {
  section: ResolvedSection;
  clip: Clip;
  values: Record<string, unknown>;
  live: PropsLive;
  /** Draws one item (field, row, sub-section, command) with its control. */
  renderItem(item: ResolvedItem, index: number): ReactNode;
  /** Whether the field at `path` can be changed now (not read-only, its `enabledWhen` holds). */
  enabled(path: string): boolean;
}

/** How a whole section is drawn (`"section"`: collapsible, its group's toggle in the header). */
export interface SectionLayout {
  id: string;
  component: ComponentType<SectionLayoutProps>;
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
