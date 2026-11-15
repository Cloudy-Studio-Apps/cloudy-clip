import type { CommandContext, Micros } from "@/core";
import { setKey } from "@/modules/keyframe";
import {
  animatedClip,
  clampToClip,
  correctionOf,
  projectRef,
  type CorrectionValues,
} from "@/modules/project";
import { leafAt, withLeaf } from "./logic/keyable";

/**
 * Turns the keyed numbers of a correction patch into keys at `at` (`keyframe.set`, run inside the
 * calling command, so one undo step), and gives the patch back with each keyed number put back to
 * its stored static value (and a keyed `opacity` left out), so what is left writes as a static
 * change. A keyed number the patch leaves at its value at `at` (a wheel's other component) gets no
 * key. A clip or node that isn't there leaves the patch as it is, for the command to refuse.
 */
export async function keyPatch<P extends { values?: Partial<CorrectionValues>; opacity?: number }>(
  ctx: CommandContext,
  clipId: string,
  nodeId: string,
  patch: P,
  at: Micros,
): Promise<P> {
  const clip = ctx.require(projectRef).store.getState().clips[clipId];
  const node = clip?.grade?.nodes[nodeId];
  const shownNode = clip && animatedClip(clip, clampToClip(clip, at)).grade?.nodes[nodeId];
  if (!clip?.animation || node?.kind !== "correct" || shownNode?.kind !== "correct") return patch;
  const stored = correctionOf(node);
  const shown = correctionOf(shownNode);
  const prefix = `grade.nodes.${nodeId}.`;
  let values: unknown = patch.values;
  let opacity = patch.opacity;
  for (const path of Object.keys(clip.animation)) {
    if (!path.startsWith(prefix)) continue;
    const sub = path.slice(prefix.length);
    if (sub === "opacity" && opacity !== undefined) {
      if (opacity !== shownNode.opacity) {
        await ctx.execute(setKey, { clipId, path, at, value: opacity });
      }
      opacity = undefined;
    }
    if (!sub.startsWith("values.")) continue;
    const field = sub.slice("values.".length);
    const value = leafAt(values, field);
    if (typeof value !== "number") continue;
    if (value !== leafAt(shown, field)) await ctx.execute(setKey, { clipId, path, at, value });
    values = withLeaf(values, field, leafAt(stored, field));
  }
  const next = { ...patch, values: values as P["values"] };
  if (opacity === undefined) delete next.opacity;
  if (next.values === undefined) delete next.values;
  return next;
}
