import type { Micros } from "@/core";
import { dbToLinear, keyMoments, trackValue, type KeyTrack } from "@/modules/project";
import type { Swell } from "../export.types";

/**
 * The level around the clips of an inner track: the swell of the inner tracks above with this
 * track's volume line on it (its volume is folded in by `soundInPlacement`, so the line adds its
 * dB alone), on the export's clock. `shift` takes the track's composition time to the export's;
 * the keys are looked for over `from..to` of that composition.
 */
export function withLine(
  above: Swell | undefined,
  line: KeyTrack | undefined,
  shift: Micros,
  from: Micros,
  to: Micros,
): Swell | undefined {
  if (!line?.keys.length) return above;
  const own = (time: Micros) => dbToLinear(Number(trackValue(line, time - shift)));
  const breaks = keyMoments(line, from, to).map((t) => t + shift);
  return {
    gain: above ? (time) => above.gain(time) * own(time) : own,
    breaks: [...(above?.breaks ?? []), ...breaks],
  };
}
