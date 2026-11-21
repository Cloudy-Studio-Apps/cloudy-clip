import type { Micros } from "@/core";
import type { Clip, CompositionId, ProjectState } from "@/modules/project";
import type { ParsedSubtitles } from "../subtitle.types";

const TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/;
const LINE = new RegExp(`^\\s*(${TIME.source})\\s*-->\\s*(${TIME.source})`);

/** Time from the four captures (h, m, s, ms) starting at `at` of a `LINE` match. */
function micros(match: RegExpMatchArray, at: number): Micros {
  const [h, m, s, ms] = match.slice(at, at + 4);
  return (
    (Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s)) * 1_000_000 +
    Number(ms!.padEnd(3, "0")) * 1000
  );
}

/**
 * Cues of an `.srt` or `.vtt` text: times `hh:mm:ss,mmm` or `mm:ss.mmm`, a VTT cue's settings and
 * tags ignored. `WEBVTT`, `NOTE` and `STYLE` blocks are skipped; a block with no time line, no
 * words or an end not after its start counts in `skipped`.
 */
export function parseSubtitles(text: string): ParsedSubtitles {
  const cues: ParsedSubtitles["cues"] = [];
  let skipped = 0;
  const blocks = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n");
    while (lines[0]?.trim() === "") lines.shift();
    const head = lines[0] ?? "";
    if (head === "" || /^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/.test(head)) continue;
    const at = lines.findIndex((line) => LINE.test(line));
    const found = at < 0 ? null : lines[at]!.match(LINE);
    const words = lines
      .slice(at + 1)
      .join("\n")
      .replace(/<[^>]*>/g, "")
      .trim();
    if (!found || words === "") {
      skipped++;
      continue;
    }
    const start = micros(found, 2);
    const end = micros(found, 7);
    if (end <= start) skipped++;
    else cues.push({ start, end, text: words });
  }
  return { cues, skipped };
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

function stamp(time: Micros): string {
  const ms = Math.round(time / 1000);
  return `${pad(Math.floor(ms / 3_600_000), 2)}:${pad(Math.floor(ms / 60_000) % 60, 2)}:${pad(Math.floor(ms / 1000) % 60, 2)},${pad(ms % 1000, 3)}`;
}

/** A composition's marked clips (cues) on its own tracks: by start, then track order. */
export function cuesOf(state: ProjectState, compositionId: CompositionId): Clip[] {
  const order = state.compositions[compositionId]?.trackOrder ?? [];
  const cues = order.flatMap((trackId, index) =>
    (state.tracks[trackId]?.clipIds ?? []).flatMap((id) => {
      const clip = state.clips[id];
      return clip?.subtitle ? [{ clip, index }] : [];
    }),
  );
  cues.sort((a, b) => a.clip.start - b.clip.start || a.index - b.index);
  return cues.map(({ clip }) => clip);
}

/** `.srt` text of a composition's marked, enabled cues on its own tracks: by start, then track order. */
export function toSrt(state: ProjectState, compositionId: CompositionId): string {
  return cuesOf(state, compositionId)
    .filter((clip) => !clip.disabled)
    .map(
      (clip, n) =>
        `${n + 1}\n${stamp(clip.start)} --> ${stamp(clip.start + clip.duration)}\n${String(clip.props.text ?? "")}\n`,
    )
    .join("\n");
}
