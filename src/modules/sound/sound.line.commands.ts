import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import {
  VOLUME_DB_MAX,
  VOLUME_DB_MIN,
  formatOfTrack,
  keyEase,
  frameDuration,
  moveTrackKeys,
  projectRef,
  trackMixOf,
  volumeDbSchema,
  withoutKeys,
  writeKey,
  writeSpan,
  type KeyTrack,
  type ProjectState,
  type Track,
  type TrackId,
} from "@/modules/project";
import { audioTrack } from "./sound.guards";
import { writeTrack } from "./sound.mix.write";

const at = z.number().int().min(0).describe("Timeline time in microseconds");

/** A track's line with no keys yet: a number track over the volume range. */
const EMPTY_LINE: KeyTrack = { blend: "number", min: VOLUME_DB_MIN, max: VOLUME_DB_MAX, keys: [] };

/** Two keys closer than half a frame are the same key. */
function tolerance(state: ProjectState, trackId: TrackId): number {
  return Math.floor(frameDuration(formatOfTrack(state, trackId)) / 2);
}

/** Stores `line` on the track's mix, or removes it when it has no keys; defaults are never stored. */
function writeLine(draft: Track, line: KeyTrack | undefined): void {
  const mix = { ...trackMixOf(draft) };
  if (line && line.keys.length > 0) mix.volumeLine = line;
  else delete mix.volumeLine;
  writeTrack(draft, mix);
}

/** The line of an audio track, or the failure to throw when it has none. */
function requireLine(track: Track): KeyTrack {
  const line = track.mix?.volumeLine;
  if (!line) {
    throw new CommandFailure("sound.no_line", `Track "${track.id}" has no volume line.`);
  }
  return line;
}

/** Fails with `sound.key_not_found` unless every id is a key of the line. */
function requireKeys(line: KeyTrack, ids: readonly string[]): void {
  const known = new Set(line.keys.map((key) => key.id));
  const missing = ids.find((id) => !known.has(id));
  if (missing) throw new CommandFailure("sound.key_not_found", `The line has no key "${missing}".`);
}

/** Adds a point to a track's volume line, or updates the one on that frame. */
export const setLineKey = defineCommand({
  id: "sound.setLineKey",
  label: "Set volume line point",
  description:
    'Writes a point on an audio track\'s volume line: at "at" (timeline microseconds) the track\'s volume is "db" (-60 to 12). A point on that frame is updated; otherwise one is added, easing like the one before it unless "ease" is given ({kind:"linear"}, {kind:"hold"}, {kind:"bezier",x1,y1,x2,y2} or {kind:"named",name:"bounce"|"elastic"}). The line holds its first level before the first point and its last after the last, and the fader adds to it. Moving or splitting clips never moves it. Fails with sound.not_audio and sound.track_not_found.',
  undoable: true,
  input: z.object({ trackId: z.string(), at, db: volumeDbSchema, ease: keyEase.optional() }),
  run(ctx, input) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const track = audioTrack(state, input.trackId);
    const line = writeKey(
      track.mix?.volumeLine ?? EMPTY_LINE,
      input.at,
      input.db,
      tolerance(state, track.id),
      input.ease,
    );
    ctx.mutate(store, (draft) => writeLine(draft.tracks[track.id]!, line));
  },
});

/** Moves points of a track's volume line in time and level. */
export const moveLineKeys = defineCommand({
  id: "sound.moveLineKeys",
  label: "Move volume line points",
  description:
    'Moves points of an audio track\'s volume line (by key id) by "delta" microseconds and "deltaDb" decibels, all together. A moved point replaces an unmoved one it lands on. Fails with sound.no_line, sound.key_not_found and sound.invalid_value (a time before 0 or a level outside -60 to 12), changing nothing.',
  undoable: true,
  input: z.object({
    trackId: z.string(),
    keyIds: z.array(z.string()).min(1),
    delta: z.number().int(),
    deltaDb: z.number(),
  }),
  run(ctx, { trackId, keyIds, delta, deltaDb }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const track = audioTrack(state, trackId);
    const line = requireLine(track);
    requireKeys(line, keyIds);
    const ids = new Set(keyIds);
    const moves = new Map<string, number>();
    const levelled: KeyTrack = {
      ...line,
      keys: line.keys.map((key) => {
        if (!ids.has(key.id)) return key;
        const t = key.t + delta;
        const db = Number(key.value) + deltaDb;
        if (t < 0 || db < VOLUME_DB_MIN || db > VOLUME_DB_MAX) {
          throw new CommandFailure(
            "sound.invalid_value",
            `A point would land at ${t} us, ${db} dB: times start at 0 and levels run from ${VOLUME_DB_MIN} to ${VOLUME_DB_MAX} dB.`,
          );
        }
        moves.set(key.id, t);
        return { ...key, value: db };
      }),
    };
    const next = moveTrackKeys(levelled, moves, tolerance(state, trackId));
    ctx.mutate(store, (draft) => writeLine(draft.tracks[trackId]!, next));
  },
});

/** Removes points from a track's volume line. */
export const removeLineKeys = defineCommand({
  id: "sound.removeLineKeys",
  label: "Remove volume line points",
  description:
    "Removes points (by key id) from an audio track's volume line. Removing the last one removes the line. Fails with sound.no_line and sound.key_not_found, changing nothing.",
  undoable: true,
  input: z.object({ trackId: z.string(), keyIds: z.array(z.string()).min(1) }),
  run(ctx, { trackId, keyIds }) {
    const { store } = ctx.require(projectRef);
    const line = requireLine(audioTrack(store.getState(), trackId));
    requireKeys(line, keyIds);
    const next = withoutKeys(line, new Set(keyIds));
    ctx.mutate(store, (draft) => writeLine(draft.tracks[trackId]!, next));
  },
});

/** Replaces the part of a track's volume line between two times with points. */
export const writePass = defineCommand({
  id: "sound.writePass",
  label: "Write volume line",
  description:
    'Replaces the points of an audio track\'s volume line from "from" to "to" (timeline microseconds, both included) with "points" ({at, db}, each inside that span, db -60 to 12); points outside the span stay as they were, and the line outside it plays as before: a point 1 microsecond before "from" and 1 after "to" holds the level it had there (none where a point already sits), so the change is a step at the span\'s edges. The line runs straight from each written point to the next. With no points the span is cleared. This is one stroke of drawing or of a recorded fader pass. Fails with sound.line_range (a point outside the span or from after to), sound.not_audio and sound.track_not_found, changing nothing.',
  undoable: true,
  input: z.object({
    trackId: z.string(),
    from: at,
    to: at,
    points: z.array(z.object({ at, db: volumeDbSchema })),
  }),
  run(ctx, { trackId, from, to, points }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const track = audioTrack(state, trackId);
    if (from > to || points.some((point) => point.at < from || point.at > to)) {
      throw new CommandFailure(
        "sound.line_range",
        `Every point must sit between from (${from}) and to (${to}), and from must not be after to.`,
      );
    }
    const next = writeSpan(
      track.mix?.volumeLine ?? EMPTY_LINE,
      from,
      to,
      points.map((point) => ({ t: point.at, value: point.db })),
      0,
    );
    ctx.mutate(store, (draft) => writeLine(draft.tracks[trackId]!, next));
  },
});

const span = z.object({
  from: at,
  to: at,
  points: z.array(z.object({ at, db: volumeDbSchema })),
});

/** Replaces several stretches of a track's volume line at once, leaving what's between them alone. */
export const writePasses = defineCommand({
  id: "sound.writePasses",
  label: "Write volume line",
  description:
    'Replaces several stretches of an audio track\'s volume line in one step, each as sound.writePass does: "spans" is a list of {from, to, points} (timeline microseconds, points {at, db} inside their span, db -60 to 12). Points between the spans stay as they were, ids and eases included. A fader pass that went round a loop or jumped ahead writes this way. Fails with sound.line_range, sound.not_audio and sound.track_not_found, changing nothing.',
  undoable: true,
  input: z.object({ trackId: z.string(), spans: z.array(span).min(1) }),
  async run(ctx, { trackId, spans }) {
    for (const { from, to, points } of spans) {
      await ctx.execute(writePass, { trackId, from, to, points });
    }
  },
});

/** Every track-line command, for the module. */
export const soundLineCommands = [setLineKey, moveLineKeys, removeLineKeys, writePass, writePasses];
