import type { StoreApi } from "zustand/vanilla";
import type { CommandBus } from "@/core";
import type { PreviewApi } from "@/modules/preview";
import type {
  ClipFit,
  ClipId,
  ClipTransform,
  FollowShift,
  PictureSize,
  ProjectFormat,
} from "@/modules/project";

/** The transform module's API: lets another canvas tool take the selection box's place. */
export interface TransformApi {
  /** Hides the selection box for `owner` while `hidden` is true; it shows again when no owner hides it. */
  hideBox(owner: string, hidden: boolean): void;
  /** Who hides the box now (the overlay draws no box while any owner does). */
  readonly boxHidden: StoreApi<{ owners: readonly string[] }>;
}

/** A point in output pixels (the project's frame). */
export interface FramePoint {
  x: number;
  y: number;
}

/** The size and position of the frame on screen (e.g. `getBoundingClientRect()`). */
export type ScreenRect = Pick<DOMRect, "left" | "top" | "width" | "height">;

/** A video clip whose picture is on screen at the playhead. */
export interface VisibleLayer {
  clipId: ClipId;
  /** Pixel size of its source picture (for text, its measured box in output pixels). */
  source: PictureSize;
  /** Fitted in the frame (media) or kept at natural size (text). */
  fit: ClipFit;
  /** The transform drawn now: the live `transform` patch, if any, over the saved one. */
  transform: ClipTransform;
  /** The transform fields its element supports (without its `except` fields). */
  fields: ReadonlySet<TransformField>;
  /** What its motion path adds to `transform` now (a follower), else undefined. */
  shift?: FollowShift;
  /** Its track is used as a matte: not picked by a click on the canvas, but boxed when selected. */
  matte?: true;
}

/** Which way `transform.flip` mirrors: left to right (`scaleX`) or upside down (`scaleY`). */
export type FlipAxis = "horizontal" | "vertical";

/** One field of a clip's transform. */
export type TransformField = keyof ClipTransform;

/**
 * What a canvas drag does: move the picture, scale it from a corner, stretch one axis from a side,
 * rotate it, or move its pivot.
 */
export type TransformGestureMode = "move" | "scale" | "rotate" | "stretchX" | "stretchY" | "pivot";

/** Everything a canvas drag needs, captured when it starts. */
export interface TransformGestureOptions {
  mode: TransformGestureMode;
  clipId: ClipId;
  start: ClipTransform;
  source: PictureSize;
  fit: ClipFit;
  /** The fields the clip's element supports; the others stay at `start`. */
  fields: ReadonlySet<TransformField>;
  /** What the clip's motion path adds to `start`: taken off again before committing. */
  shift?: FollowShift;
  format: ProjectFormat;
  /** The overlay, which covers the frame exactly. */
  frame: HTMLElement;
  /** The selection box, moved directly while dragging. */
  box: HTMLElement | null;
  /** Center guide lines, shown while the move snaps to them. */
  guides: { vertical: HTMLElement | null; horizontal: HTMLElement | null };
  down: PointerEvent;
  preview: PreviewApi;
  bus: CommandBus;
}

declare module "@/core" {
  interface CommandInputs {
    "transform.reset": { clipIds: string[] };
    "transform.flip": { clipIds: string[]; axis: FlipAxis };
  }
}
