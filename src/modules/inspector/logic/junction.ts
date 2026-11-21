import { secondsToMicros } from "@/core";
import type { JunctionEdit } from "../inspector.types";

/** The `junction.set` input for one junction: the patch as is, the duration in integer µs. */
export function junctionSetInput(
  id: string,
  edit: JunctionEdit,
): { junctionIds: string[]; patch?: Record<string, unknown>; duration?: number } {
  return {
    junctionIds: [id],
    ...(edit.patch !== undefined && { patch: edit.patch }),
    ...(edit.seconds !== undefined && { duration: secondsToMicros(edit.seconds) }),
  };
}
