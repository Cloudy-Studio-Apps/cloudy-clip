import type { CommandBus } from "@/core";
import type { PreviewApi } from "@/modules/preview";
import type { ClipId, ClipTransform, PictureSize, ProjectFormat } from "@/modules/project";

/** The transform module's API. Empty: its command and preview overlay are its whole surface. */
export type TransformApi = Record<string, never>;

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
  /** Pixel size of its source picture. */
  source: PictureSize;
}

/** What a canvas drag does: move the picture, scale it from a corner, or rotate it. */
export type TransformGestureMode = "move" | "scale" | "rotate";

/** Everything a canvas drag needs, captured when it starts. */
export interface TransformGestureOptions {
  mode: TransformGestureMode;
  clipId: ClipId;
  start: ClipTransform;
  source: PictureSize;
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
