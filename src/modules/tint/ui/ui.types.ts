import type { ComponentType } from "react";
import type { ClipGrade, ClipId, GradeNodeId } from "@/modules/project";
import type { StackPosition, TintView } from "../tint.types";

/** The viewer's on/off tools, by their key in the view state. */
export type ViewerToggle = keyof Pick<
  TintView,
  "compare" | "bypass" | "samples" | "falseColor" | "warning" | "guides" | "clean"
>;

/** A button of the viewer's tool bar. `side` (side by side) has no state yet. */
export interface ViewerTool {
  key: ViewerToggle | "side";
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

/** What the layer list can do to the current clip's grade. Each runs a command and tells the user if it is refused. */
export interface LayerActions {
  /** Adds a correction before the layer `before`, or at the bottom of the stack, and selects it. */
  add(before?: string): Promise<void>;
  /** Resolves false when the command was refused (the user was told). */
  change(nodeId: string, patch: LayerPatch): Promise<boolean>;
  remove(nodeId: string): void;
  move(nodeId: string, to: StackPosition): void;
}

/** What the rows of the layer list read: the clip's grade, the numbers, the thumbnails and the actions. */
export interface LayersEnv {
  clipId: ClipId;
  grade: ClipGrade;
  numbers: Record<GradeNodeId, string>;
  /** Object URLs of the picture after each layer, as far as they are drawn. */
  thumbs: Record<GradeNodeId, string>;
  actions: LayerActions;
  /** Starts a drag from a row's grip. */
  drag(event: PointerEvent, id: string): void;
}
