import type { Clip, KeyTrack, Track } from "@/modules/project";
import type { KeyableField, PropSpec, ResolvedElement } from "../element.types";

/** How a kind of value blends between keys; undefined when it can't be keyed. */
function blendOf(spec: PropSpec): KeyTrack["blend"] | undefined {
  if (spec.kind === "number") return "number";
  if (spec.kind === "color") return "color";
  if (spec.kind === "enum" || spec.kind === "boolean") return "step";
  return undefined;
}

/**
 * The fields of an element that can hold keys: numbers, colors, enums and booleans, not text,
 * custom values, read-only fields or those that opt out with `keyframes: false`. A shared group's
 * fields count only where the group applies to the clip on its track; without a clip and track
 * that check is skipped.
 */
export function keyableFields(
  element: ResolvedElement,
  clip?: Clip,
  track?: Track,
): KeyableField[] {
  const out: KeyableField[] = [];
  for (const [path, spec] of element.fields) {
    const blend = blendOf(spec);
    if (!blend || spec.readOnly || spec.keyframes === false) continue;
    const group = element.groups.find((g) => path.startsWith(`${g.key}.`));
    if (group && clip && track && group.appliesTo && !group.appliesTo(clip, track)) continue;
    out.push({ path, spec, blend, shared: group !== undefined });
  }
  return out;
}
