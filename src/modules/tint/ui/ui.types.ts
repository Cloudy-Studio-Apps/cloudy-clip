import type { ComponentType } from "react";
import type {
  BlendMode,
  ClipGrade,
  ClipId,
  Correction,
  CorrectionValues,
  GradeLimit,
  GradeNodeId,
} from "@/modules/project";
import type {
  ChartCorners,
  GradeLevel,
  GradeTarget,
  StackPosition,
  WireEntry,
} from "../tint.types";

/**
 * The grade the page edits: the current clip's own, its shot group's or the open composition's
 * whole-timeline one, by the level switch (`view.level`).
 */
export interface GradeSubject {
  level: GradeLevel;
  /** What commands are sent to. */
  target: GradeTarget;
  /** The id of the grade's holder (clip, group or composition): its live values' key. */
  id: string;
  /** The current clip: the picture thumbnails and pickers read. */
  clipId: ClipId;
  grade: ClipGrade | null;
}

/** A button of the viewer's tool bar: before/after and bypass (the preview's picture state) or an inspect tool (the page's view state). */
export interface ViewerTool {
  key: "compare" | "bypass" | "samples" | "falseColor" | "warning" | "guides";
  icon: ComponentType;
  label: string;
}

/** Moves the node graph's view. Created on the graph's elements, disposed with them. */
export interface GraphCamera {
  /** Brings the whole graph back into view. */
  fit(): void;
  dispose(): void;
}

/** A change to a correction from its row (a subset of `tint.setCorrection`'s patch). */
export interface LayerPatch {
  opacity?: number;
  on?: boolean;
  name?: string;
}

/** A change to a side-by-side or stacked group from its folder (`tint.setGroup`'s patch). */
export interface GroupPatch {
  opacity?: number;
  on?: boolean;
  blends?: BlendMode[];
}

/** What the layer list can do to the current clip's grade. Each runs a command and tells the user if it is refused. */
export interface LayerActions {
  /** Adds a correction at a place in the stack (the bottom without one) and selects it. */
  add(at?: StackPosition): Promise<void>;
  /** Puts items of one list in a group and selects the group. */
  group(ids: string[], kind: "parallel" | "layer" | "channels"): Promise<void>;
  /** Takes a group apart. */
  ungroup(joinId: string): void;
  /** Changes a group's opacity, on or blends. Resolves false when refused. */
  changeGroup(joinId: string, patch: GroupPatch): Promise<boolean>;
  /** Resolves false when the command was refused (the user was told). */
  change(nodeId: string, patch: LayerPatch): Promise<boolean>;
  remove(nodeId: string): void;
  move(nodeId: string, to: StackPosition): void;
}

/** What the rows of the layer list read: the clip's grade, the numbers, the thumbnails and the actions. */
export interface LayersEnv {
  subject: GradeSubject;
  grade: ClipGrade;
  numbers: Record<GradeNodeId, string>;
  /** Object URLs of the picture after each layer, as far as they are drawn. */
  thumbs: Record<GradeNodeId, string>;
  actions: LayerActions;
  /** Starts a drag from a row's grip. */
  drag(event: PointerEvent, id: string): void;
}

/** A change to a correction's values, opacity, on or limit (null removes it), from a tool; or to a group's opacity, on or blends. */
export interface EditPatch {
  values?: Partial<CorrectionValues>;
  opacity?: number;
  on?: boolean;
  limit?: GradeLimit | null;
  lut?: Correction["lut"] | null;
  blends?: BlendMode[];
}

/** Edits one correction: live while a gesture goes, one command when it ends. */
export interface LiveEdit {
  /** False without a clip to grade: nothing can be edited. */
  enabled: boolean;
  /** Counts the commands that were refused: key a control's body by it to put the saved values back. */
  rev: number;
  /** Shows the patch in the viewer at once (not saved). Merges with what was previewed before. */
  preview(patch: EditPatch): void;
  /** Saves the patch as one undo step and drops the live values. Without a correction, the first edit adds one. */
  commit(patch: EditPatch): Promise<void>;
  /** Drops the live values. */
  cancel(): void;
}

/** The correction the tools edit: the selected layer, else the first one, else none yet. */
export interface EditTarget {
  /** The grade being edited, or null when there is nothing to grade at this level. */
  subject: GradeSubject | null;
  grade: ClipGrade | null;
  /** The correction being edited; null before the clip has one (the first edit makes it). */
  nodeId: GradeNodeId | null;
  /** The selected group, when a group is selected: the header's reset covers all of it. */
  group: { id: GradeNodeId; kind: "parallel" | "layer" | "channels" } | null;
  /** The correction's values over the defaults. */
  values: CorrectionValues;
  /** Layer number and name for the tool header, or null. */
  title: string | null;
}

/** Edits the limit of the correction the tools edit (Limit's controls). */
export interface LimitEdit {
  /** False without a clip to grade. */
  enabled: boolean;
  /** The correction being edited; null before the clip has one (the first edit makes it). */
  nodeId: GradeNodeId | null;
  /** Its limit as saved, if any. */
  limit: GradeLimit | undefined;
  /** Counts refused commands (`LiveEdit.rev`). */
  rev: number;
  /** Shows a limit in the viewer at once (not saved). */
  preview(limit: GradeLimit): void;
  /** Saves a limit as one undo step (none when it is the saved one). */
  commit(limit: GradeLimit): void;
  /** Drops what was previewed. */
  cancel(): void;
}

/** A drag in the node graph, in graph units from where the press began. */
export interface GraphDragMove {
  dx: number;
  dy: number;
  /** The pointer, in graph units. */
  at: readonly [number, number];
}

/** What starts a drag in the node graph. */
export interface GraphDragOptions {
  /** The pointerdown that started it. */
  event: PointerEvent;
  svg: SVGSVGElement;
  /** Called on every move once past the dead zone. Draw to the DOM only. */
  onMove(move: GraphDragMove): void;
  /** Once: on release (where it ended), or null on Escape or when the pointer never left the dead zone. */
  onEnd(move: GraphDragMove | null): void;
}

/** What the node graph can do to the current clip's grade. Each runs a command and tells the user if it is refused; false when it was. */
export interface GraphActions {
  /** Moves nodes (the rest stay where they are drawn): one undo step. */
  place(moved: Record<string, { x: number; y: number }>): Promise<boolean>;
  /** Wires: one undo step. */
  wire(entry: WireEntry): Promise<boolean>;
  /** Adds a correction before the selected one (else at the bottom), at a place, and selects it. */
  addCorrection(at: readonly [number, number]): Promise<void>;
  /** Wraps the selection in a group, as Baby Seal's + Add does. */
  group(ids: string[], kind: "parallel" | "layer" | "channels"): Promise<void>;
  /** Adds a key join of the selected correction's key, at a place, and selects it. */
  sharedKey(at: readonly [number, number]): Promise<void>;
  remove(nodeId: string): void;
  /** Every node to its automatic place. */
  tidy(): void;
  reset(): void;
}

/** A space's name in full (the LUT tool) and short (Baby Seal's flow label). */
export interface SpaceName {
  name: string;
  short: string;
}

/** A drag of one of the color chart's corners over the viewer. */
export interface CornerDragOptions {
  /** The pointerdown that started it, on the corner. */
  event: PointerEvent;
  /** The box over the frame the corners are measured in. */
  box: HTMLElement;
  corners: ChartCorners;
  /** The corner being dragged. */
  index: number;
  /** Fires on every move past the dead zone with the corners as they would be. Draw to the DOM only. */
  onMove(corners: ChartCorners): void;
  /** Fires once: the corners on release, or null on Escape, a cancel, or a click that never moved. */
  onEnd(corners: ChartCorners | null): void;
}
