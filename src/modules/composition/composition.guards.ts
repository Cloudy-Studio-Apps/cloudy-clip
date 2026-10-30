import { z } from "zod";
import { CommandFailure, type Micros } from "@/core";
import {
  frameDuration,
  type Composition,
  type ProjectFormat,
  type ProjectState,
} from "@/modules/project";

/** Smallest and largest side of a composition, in pixels. */
const MIN_SIDE = 2;
const MAX_SIDE = 8192;

/** Input schema of a composition's output format. */
export const formatInput = z.object({
  width: z.number().int().describe("Pixels, 2 to 8192"),
  height: z.number().int().describe("Pixels, 2 to 8192"),
  fps: z.number().positive().max(240).describe("Frames per second, 30000/1001 for 29.97"),
});

/** The composition, or a `composition.not_found` failure. */
export function requireComposition(state: ProjectState, id: string): Composition {
  const composition = state.compositions[id];
  if (!composition) {
    throw new CommandFailure("composition.not_found", `No composition with id "${id}"`);
  }
  return composition;
}

/** Refuses a length under one frame, which would shrink every placement to nothing. */
export function checkLength(duration: Micros, format: ProjectFormat): void {
  if (duration < frameDuration(format)) {
    throw new CommandFailure("composition.too_short", "A composition lasts at least one frame.");
  }
}

/** Refuses a size outside what a composition can be. */
export function checkFormat(format: ProjectFormat): void {
  const fits = (side: number) => side >= MIN_SIDE && side <= MAX_SIDE;
  if (!fits(format.width) || !fits(format.height)) {
    throw new CommandFailure(
      "composition.invalid_size",
      `Width and height go from ${MIN_SIDE} to ${MAX_SIDE} pixels.`,
    );
  }
}

/** Input of a length. */
const duration = z.number().int().positive().describe("Microseconds");
/** Input naming a composition. */
export const compositionId = z.string().describe("A composition's id, from project_get_state");

/** Input of what a composition can set. */
export const settings = {
  name: z.string().min(1).max(120).optional(),
  format: formatInput.optional(),
  background: z.string().min(1).max(40).optional().describe("CSS colour, #000000 by default"),
  duration: duration.optional(),
  extendToFit: z.boolean().optional().describe("The length follows the end of the last clip"),
};
