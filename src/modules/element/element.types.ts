import type { LucideIcon } from "lucide-react";
import type { z } from "zod";
import type { Micros, ModuleRef, PanelCommandId } from "@/core";
import type {
  Clip,
  KeyTrack,
  ClipPlacement,
  PictureSize,
  ProjectFormat,
  ProjectState,
  SharedGroupValues,
  Track,
  TrackKind,
} from "@/modules/project";

/** The kind of value a property holds. */
export type PropKind =
  "string" | "number" | "boolean" | "color" | "gradient" | "enum" | "group" | "custom";

/** A condition on the element's values: a path to a boolean (`"outline.enabled"`) or a function. */
export type PropCondition = string | ((props: Record<string, unknown>) => boolean);

/** How a property shows in the inspector. None of it changes what is stored. */
export interface PropUi {
  /** Label in the panel; defaults to the field name ("letterSpacing" → "Letter spacing"). */
  label?: string;
  /** Control id from the inspector's `propertyControls`; defaults by value type. */
  control?: string;
  /** Range of the control, when it should be narrower than what may be stored. */
  ui?: { min?: number; max?: number; step?: number };
  /** Shown value = stored × `scale`, with `unit` (opacity 0–1 shown as %). */
  display?: { scale?: number; unit?: string };
  /** Icon name (lucide) for icon controls. */
  icon?: string;
  /** Stored and validated, but not shown in the panel. */
  hidden?: boolean;
  /** Shown disabled; `element.setProps` refuses it. */
  readOnly?: boolean;
  /** `false` keeps a field that could be keyed (a number, color, enum, boolean) static. */
  keyframes?: false;
  /** Shown only while the condition holds. */
  visibleWhen?: PropCondition;
  /** Greyed out unless the condition holds. */
  enabledWhen?: PropCondition;
}

/**
 * One declared property, made with the `prop.*` builders. `T` is the type of its value (a phantom
 * field, never set), so an element's values can be typed with `PropsOf`.
 */
export interface PropSpec<T = unknown> extends PropUi {
  kind: PropKind;
  readonly __value?: T;
  /** number: range and step; string: length. */
  min?: number;
  max?: number;
  step?: number;
  /** number: unit shown next to it ("px", "°"). */
  unit?: string;
  /** string: several lines. */
  multiline?: boolean;
  /** string: trimmed before it is checked and stored. */
  trim?: boolean;
  /** enum: the allowed values and their labels. */
  values?: readonly string[];
  labels?: Readonly<Record<string, string>>;
  /** color: a sibling 0–1 number edited by the same color field. */
  opacity?: string;
  /** group: the boolean field that switches the group on (shown in its header). */
  toggle?: string;
  /** group: its fields. */
  fields?: PropertyTree;
  /** custom: the prop type's name in `propTypes`, and its arguments. */
  type?: string;
  args?: unknown;
}

/** An element's declared properties by name. `"group.field"` keys narrow a shared group's field. */
export type PropertyTree = Readonly<Record<string, PropSpec>>;

/** The values of a property tree. */
export type PropsOf<T extends PropertyTree> = {
  [K in keyof T]: T[K] extends PropSpec<infer V> ? V : never;
};

/** A partial set of values: fields optional, groups partial (one level deep). */
export type PropsPatch<P> = {
  [K in keyof P]?: P[K] extends object ? Partial<P[K]> : P[K];
};

/**
 * Arguments of custom prop types by name, extended by the module that registers each one:
 * `declare module "@/modules/element" { interface CustomProps { font: { sources: FontSource[] } } }`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by declaration merging
export interface CustomProps {}

/** Values of custom prop types by name, extended next to `CustomProps`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by declaration merging
export interface CustomValues {}

/** A kind of value beyond the built-in ones (a font), registered in `propTypes`. */
export interface PropType {
  /** The name `prop.custom(name, …)` uses. */
  name: string;
  /** The Zod schema of a value, for these arguments. */
  schema(args: unknown): z.ZodType;
  /** The control that edits it by default. */
  control: string;
}

/**
 * Properties several elements share (transform), defined once by the module that owns them and
 * opted into with an element's `supports`. Their values live on the clip under `key`.
 */
export interface SharedGroup {
  /** The name used in `supports`. */
  id: string;
  /** Where its values are stored on a clip. */
  key: keyof SharedGroupValues;
  label: string;
  /** Position of its section in the panel. */
  order: number;
  properties: PropertyTree;
  defaults(format: ProjectFormat): Record<string, unknown>;
  /** Fixes the merged values before they are stored (e.g. brings rotation into range). */
  normalize?(value: Record<string, unknown>): Record<string, unknown>;
  /** Whether the group applies to this clip on this track (transform: video tracks only). */
  appliesTo?(clip: Clip, track: Track): boolean;
  /** Its section; generated from its properties when missing. */
  layout?: LayoutSection;
}

/** What `normalize` gets besides the merged values. */
export interface NormalizeEnv {
  /** The patch being applied (as given), to tell what the user asked for from what was there. */
  patch: Record<string, unknown>;
  format: ProjectFormat;
  /** Another module's API (fonts, to check faces). */
  require<A>(ref: ModuleRef<A>): A;
}

/** What `display` gets besides the clip. */
export interface DisplayEnv {
  project: ProjectState;
  track: Track | undefined;
}

/** How a clip shows on the timeline and in the inspector's header. */
export interface ElementDisplay {
  icon: LucideIcon;
  /** Color token suffix: `clip-video` → `bg-clip-video`. */
  color: string;
  label: string;
  /** What the timeline draws inside the clip. */
  body: "poster" | "waveform" | "none";
}

/** What `draw` gets besides the values. */
export interface DrawEnv {
  format: ProjectFormat;
  /** Where the picture lands, from `clipPlacement` with the element's size and fit. */
  placement: ClipPlacement;
  /** Time since the clip started, for pictures that move. */
  time: Micros;
  /** Canvas pixels per output pixel. */
  kx: number;
  ky: number;
  measure: TextMeasure;
  /** Whether a font face is ready; starts loading it when not. */
  ensureFont(request: FaceRequest): boolean;
}

/** A font face to draw with (a `FontRequest` of `fonts`, without depending on it). */
export interface FaceRequest {
  family: string;
  source: string;
  /** `"100"` … `"900"`. */
  weight: string;
  style: "normal" | "italic";
}

/** How an element is drawn in the frame. */
export interface PictureDefinition<P> {
  /** `contain`: fitted in the frame before its transform; `none`: natural size in output px. */
  fit: "contain" | "none";
  /**
   * `media`: decoded from the clip's file by the preview engine; `composition`: rendered from
   * the clip's composition. Neither has `size` or `draw`.
   */
  source?: "media" | "composition";
  /** Size of the picture before its transform, in output pixels. */
  size?(props: P, env: { format: ProjectFormat; measure: TextMeasure }): PictureSize;
  /** Paints the picture. The canvas is in canvas pixels; use `env.placement`, `kx`, `ky`. */
  draw?(ctx: CanvasRenderingContext2D, props: P, env: DrawEnv): void;
  /**
   * Whether `draw` can paint this frame; asking may start loading what it needs. The engine holds
   * the frame while it says no, so it must say yes once loading has failed. Absent means ready.
   */
  ready?(props: P, env: { time: Micros }): boolean;
}

/** A tile that creates this element from a side panel. */
export interface CreateEntry {
  /** The panel id that shows the tile (`CreateTiles panel="text"`). */
  panel: string;
  id: string;
  label: string;
  /** Values of the new clip (may include shared groups, like `transform`). */
  props?(format: ProjectFormat): Record<string, unknown>;
}

/** An item of a layout section. */
export type LayoutItem =
  | string
  | { path: string; control?: string; label?: string }
  | { row: LayoutItem[]; label?: string }
  | { title: string; items: LayoutItem[] }
  | { group: string; items: string[] }
  | { command: PanelCommandId; control?: string; label?: string; icon?: string };

/** A section of an element's panel. */
export interface LayoutSection {
  /** Heading; a group alone in the section gives its label. */
  title?: string;
  order?: number;
  /** Section layout id from the inspector's `sectionLayouts`; `"section"` by default. */
  layout?: string;
  /** Id of the inspector tab it shows in (from `inspectorTabs`); the Video tab by default. */
  tab?: string;
  items: LayoutItem[];
}

/**
 * A kind of clip: its properties, panel, picture, timeline look and how it is created. Declared
 * once with `defineElement` and contributed to the `elements` point.
 */
export interface ElementDefinition<P = Record<string, unknown>> {
  /** Stored as `clip.kind`. */
  kind: string;
  /** Human name ("Text"). */
  name: string;
  /**
   * `media`: plays a file (`clip.mediaId`); `composition`: plays a composition
   * (`clip.compositionRef`); `none`: no source file, any length.
   */
  source: "media" | "composition" | "none";
  /** Track kinds it may sit on, preferred first. */
  tracks: readonly TrackKind[];
  /** Shared groups it opts into, whole or `except` some fields. */
  supports?: Readonly<Record<string, true | { except: readonly string[] }>>;
  properties: PropertyTree;
  /** Values of a clip that stores none. */
  defaults(format: ProjectFormat): P;
  /** Cross-field rules on the merged values; may throw `CommandFailure`. */
  normalize?(next: P, env: NormalizeEnv): P;
  display(clip: Clip, env: DisplayEnv): ElementDisplay;
  layout?: readonly LayoutSection[];
  picture?: PictureDefinition<P>;
  create?: readonly CreateEntry[];
}

/** Any element, as the `elements` point holds them. */
export type AnyElement = ElementDefinition<Record<string, unknown>>;

/** An element from `defineElement`, with a typed reader of a clip's values. */
export type DefinedElement<P> = ElementDefinition<P> & {
  /** The clip's values: its stored props over the element's defaults for `format`. */
  resolve(clip: { props?: Record<string, unknown> }, format: ProjectFormat): P;
};

/** The control id `resolveLayout` picks for a field that names none. */
export type LayoutControlOf = (path: string, spec: PropSpec) => string;

/** What `patchSchema` needs besides the element's own properties. */
export interface SchemaEnv {
  /** A registered custom prop type by name. */
  propType(name: string): PropType | undefined;
  /** Supported shared groups: their key on the clip and their (narrowed) fields. */
  groups: readonly { key: string; tree: PropertyTree }[];
}

/** What `resolveLayout` reads: an element, or any other kind of properties (a junction's). */
export interface LayoutSource {
  definition: Pick<AnyElement, "kind" | "properties" | "layout">;
  groups: readonly SharedGroup[];
  /** Every field by path (see `indexFields`). */
  fields: ReadonlyMap<string, PropSpec>;
}

/** An element with what the registry works out from it, for one kernel. */
export interface ResolvedElement {
  definition: AnyElement;
  /** Supported shared groups, without their `except` fields and with the element's overrides. */
  groups: readonly SharedGroup[];
  /** Every field by path: `size`, `outline`, `outline.width`, `transform.x`. */
  fields: ReadonlyMap<string, PropSpec>;
  /** Schema of a patch of the element's values and its groups' values. */
  schema: z.ZodObject;
}

/** The element module's API: the registered elements of this kernel. */
export interface ElementApi {
  /** The element of this kind, or undefined when no module registered it. */
  get(kind: string): ResolvedElement | undefined;
  /** Every registered element, in registration order. */
  list(): readonly ResolvedElement[];
  /**
   * A clip's values: its props over its element's defaults, plus each supported group's values
   * under its key (`transform`). Empty for an unknown kind.
   */
  resolve(clip: Clip, format: ProjectFormat): Record<string, unknown>;
  /** What `resolve` gives for a clip of this kind that stores nothing. Empty for an unknown kind. */
  defaults(kind: string, format: ProjectFormat): Record<string, unknown>;
  /** Logs a warning about a declaration once per kernel, however often it is met. */
  warn(message: string): void;
}

/** A field that can hold keys: its path, its declaration, how its values blend. */
export interface KeyableField {
  path: string;
  spec: PropSpec;
  blend: KeyTrack["blend"];
  /** Its value sits under a shared group's key on the clip (`transform.x`), not in `props`. */
  shared: boolean;
}

/** New values of shared groups by key; undefined means back to the defaults (removed). */
export type GroupWrites = Array<
  [keyof SharedGroupValues, SharedGroupValues[keyof SharedGroupValues] | undefined]
>;

declare module "@/core" {
  interface CommandInputs {
    "element.resetProps": { clipIds: string[]; paths?: string[] };
  }
}

/** An item of a resolved panel section. */
export type ResolvedItem =
  | { type: "field"; path: string; control: string; label: string }
  | { type: "row"; label?: string; items: ResolvedItem[] }
  | { type: "sub"; title: string; header?: string; items: ResolvedItem[] }
  | { type: "command"; id: string; control?: string; label?: string; icon?: string };

/** A panel section with every item worked out: paths checked, controls and labels picked. */
export interface ResolvedSection {
  key: string;
  title: string;
  order: number;
  /** Section layout id (`"section"` by default). */
  layout: string;
  /** Id of the inspector tab it shows in, when its layout names one. */
  tab?: string;
  /** Path of the boolean shown in the header (a group's toggle). */
  header?: string;
  items: ResolvedItem[];
}

/** A mistake in a declaration, worth a warning; the panel still renders. */
export interface LayoutIssue {
  message: string;
}

/** Whether a command can be placed in a panel, and the one field the panel draws for it. */
export type PanelCommandCheck =
  | { ok: true; field?: { name: string; schema: z.ZodType } }
  | { ok: false; reason: "missing" | "no_clip_ids" | "too_many_fields"; message: string };

/** Width of `text` drawn in the CSS `font` with `letterSpacing` pixels between letters (canvas `measureText`, faked in tests). */
export type TextMeasure = (text: string, font: string, letterSpacing: number) => number;

/** The part of a 2D canvas context `canvasTextMeasure` uses; `letterSpacing` is missing in some webviews. */
export interface TextMeasureContext {
  font: string;
  letterSpacing?: string;
  measureText(text: string): { width: number };
}
