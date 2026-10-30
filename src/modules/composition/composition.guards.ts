import { z } from "zod";
import { CommandFailure } from "@/core";
import type { Composition, ProjectFormat, ProjectState } from "@/modules/project";

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
