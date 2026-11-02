import type { LucideIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import type { z } from "zod";
import type { PropSpec, ResolvedElement, ResolvedItem, ResolvedSection } from "@/modules/element";
import type { Clip, ProjectState, Track } from "@/modules/project";
import type { StoreApi } from "zustand/vanilla";

/** The colors picked lately, shared by every color field of the inspector. Not in history. */
export interface RecentColors {
  /** Newest first, at most 12. Read with `useStore(recents.store, selector)`. */
  readonly store: StoreApi<{ colors: string[] }>;
  /** Remembers a color (and saves the list). */
  push(color: string): void;
}

/** What the panel remembers while the app runs. Not in history. */
export interface InspectorViewState {
  /** The tab last picked, by clip kind. */
  tabs: Readonly<Record<string, string>>;
  /** Keys of the sections folded shut. */
  folded: readonly string[];
}

/** The panel's view state: which tab is open and which sections are folded. */
export interface InspectorView {
  /** Read with `useStore(view.store, selector)`. */
  readonly store: StoreApi<InspectorViewState>;
  setTab(kind: string, tabId: string): void;
  toggleFold(key: string): void;
}

/** The inspector module's API: the recent colors every color field shares and the view state. */
export interface InspectorApi {
  readonly recents: RecentColors;
  readonly view: InspectorView;
}

/** A tab of a clip's panel. */
export interface InspectorTab {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Position in the strip, lowest first. */
  order: number;
  /** Left out, not greyed out, when no section lands in it (Text, Sticker). */
  contextual?: boolean;
}

/** A tab of the strip for one clip: greyed out while nothing lands in it. */
export interface TabState {
  tab: InspectorTab;
  available: boolean;
}

/** One section of a clip's panel, from its element's layout or the `inspectorSections` point. */
export type PanelEntry =
  | {
      type: "layout";
      key: string;
      order: number;
      /** The clip it edits: the one shown, or its linked partner. */
      member: InspectorMember;
      source: ResolvedElement;
      section: ResolvedSection;
    }
  | { type: "section"; key: string; order: number; item: InspectorSectionItem };

/** A clip's panel: the strip, the open tab and that tab's sections in order. */
export interface ClipPanel {
  tabs: TabState[];
  active: string | undefined;
  entries: PanelEntry[];
}

/** A clip and the track it sits on. */
export interface InspectorMember {
  clip: Clip;
  track: Track;
}

/** The clip a panel shows, with its linked partner when it has one. */
export interface InspectorContext extends InspectorMember {
  partner?: InspectorMember;
}

/** A section of a clip's panel that isn't a property of its element. */
export interface InspectorSectionItem {
  id: string;
  /** Id of the tab it shows in. */
  tab: string;
  title: string;
  /** Position among the tab's sections, lowest first. */
  order: number;
  /** Whether it shows for this clip; without it, always. */
  appliesTo?(context: InspectorContext, project: ProjectState): boolean;
  /** Draws its own bands instead of being wrapped in one. */
  bare?: boolean;
  component: ComponentType<{ context: InspectorContext }>;
}

/** What a field action gets: the values it is about. */
export interface FieldActionProps {
  /** The paths of the row: one field and its opacity, or every field of a row. */
  paths: readonly string[];
  values: Record<string, unknown>;
  /** The values of a subject that stores none, when the panel knows them. */
  defaults?: Record<string, unknown>;
  live: PropsLive;
  disabled: boolean;
}

/** Something at the end of a field's row. */
export interface FieldAction {
  id: string;
  /** Position in the row's end, lowest first. */
  order: number;
  /** Whether it shows for this field; without it, always. */
  appliesTo?(spec: PropSpec): boolean;
  component: ComponentType<FieldActionProps>;
}

/** What a panel edits: a clip, or a junction. Only its id and kind are known to controls. */
export interface PanelSubject {
  id: string;
  kind: string;
}

/** What a field control gets: the value at its path and a way to change it. */
export interface FieldControlProps {
  /** The clip (or junction) being edited. */
  clip: PanelSubject;
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
  clip: PanelSubject;
  values: Record<string, unknown>;
  live: PropsLive;
  /** Draws one item (field, row, sub-section, command) with its control. */
  renderItem(item: ResolvedItem, index: number): ReactNode;
  /** Whether the field at `path` can be changed now (not read-only, its `enabledWhen` holds). */
  enabled(path: string): boolean;
  /** Key of this section in the view state: pass it to `InspectorSection`. */
  foldKey: string;
  /** The section's reset, when its subject can be reset. */
  reset?: SectionReset;
}

/** Puts every field of a section back to its default, as one undo step. */
export interface SectionReset {
  /** Whether any field differs from its default. */
  changed: boolean;
  run(): void;
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
  /** Puts paths back to their defaults as one undo step. Missing when the subject can't. */
  reset?(paths: readonly string[]): void;
}

/** What `createPropsLive` needs: the preview, the clip's current values and the command. */
export interface PropsLiveDeps {
  /** Shows a live patch (null clears it). */
  preview(patch: Record<string, unknown> | null): void;
  /** The clip's resolved values now, or null when it is gone. */
  read(): Record<string, unknown> | null;
  /** Runs the command with the whole patch. */
  commit(patch: Record<string, unknown>): Promise<unknown>;
  /** Puts paths back to their defaults; without it, the subject can't be reset. */
  reset?(paths: readonly string[]): Promise<unknown>;
}

/** What a junction panel changes: some values and/or the overlap (in seconds, as shown). */
export interface JunctionEdit {
  patch?: Record<string, unknown>;
  seconds?: number;
}
