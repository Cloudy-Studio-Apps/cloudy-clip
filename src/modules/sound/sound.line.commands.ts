import { z } from "zod";
import { CommandFailure, defineCommand, type CommandContext } from "@/core";
import {
  VOLUME_DB_MAX,
  VOLUME_DB_MIN,
  compositionMixOf,
  keyEase,
  frameDuration,
  moveTrackKeys,
  projectRef,
  trackMixOf,
  volumeDbSchema,
  withoutKeys,
  writeKey,
  writeSpan,
  type CompositionId,
  type KeyTrack,
  type ProjectState,
} from "@/modules/project";
import { audioTrack } from "./sound.guards";
import { targetComposition, writeComposition, writeTrack } from "./sound.mix.write";
import type { LineOwner, LineTarget } from "./sound.types";

const at = z.number().int().min(0).describe("Timeline time in microseconds");
const target = z
  .string()
  .describe('An audio track id, or "master" for the master of a composition.');
const compositionId = z
  .string()
  .optional()
  .describe("For the master: the composition (default: your open one).");

/** A line with no keys yet: a number track over the volume range. */
const EMPTY_LINE: KeyTrack = { blend: "number", min: VOLUME_DB_MIN, max: VOLUME_DB_MAX, keys: [] };

/** The keys, or none when it has none: a line with no keys is never stored. */
const keyed = (line: KeyTrack | undefined) => (line && line.keys.length > 0 ? line : undefined);

/**
 * The volume line of an audio track or of a composition's master (`"master"`, of `compositionId`,
 * default the actor's open one), with how close two keys merge (half a frame) and how to write it.
 * Fails with `sound.track_not_found`, `sound.not_audio` and `composition.not_found`.
 */
function lineOwner(
  ctx: CommandContext,
  state: ProjectState,
  who: LineTarget,
  compositionIdInput: CompositionId | undefined,
): LineOwner {
  if (who === "master") {
    const id = targetComposition(ctx, compositionIdInput);
    const composition = state.compositions[id]!;
    return {
      line: compositionMixOf(composition).master.volumeLine,
      tolerance: Math.floor(frameDuration(composition.format) / 2),
      write(draft, line) {
        const target = draft.compositions[id]!;
        const mix = compositionMixOf(target);
        writeComposition(target, { ...mix, master: { ...mix.master, volumeLine: keyed(line) } });
      },
    };
  }
  const track = audioTrack(state, who);
  return {
    line: track.mix?.volumeLine,
    tolerance: Math.floor(frameDuration(state.compositions[track.compositionId]!.format) / 2),
    write(draft, line) {
      const mix = { ...trackMixOf(draft.tracks[who]!) };
      const next = keyed(line);
      if (next) mix.volumeLine = next;
      else delete mix.volumeLine;
      writeTrack(draft.tracks[who]!, mix);
    },
  };
}

/** The line of an owner, or the failure to throw when it has none. */
function requireLine(owner: LineOwner, who: LineTarget): KeyTrack {
  if (!owner.line) {
    const name = who === "master" ? "The master" : `Track "${who}"`;
    throw new CommandFailure("sound.no_line", `${name} has no volume line.`);
  }
  return owner.line;
}

/** Fails with `sound.key_not_found` unless every id is a key of the line. */
function requireKeys(line: KeyTrack, ids: readonly string[]): void {
  const known = new Set(line.keys.map((key) => key.id));
  const missing = ids.find((id) => !known.has(id));
  if (missing) throw new CommandFailure("sound.key_not_found", `The line has no key "${missing}".`);
}

/** Runs `next` on the owner's line and writes what it gives, in one step. */
function editLine(
  ctx: CommandContext,
  who: LineTarget,
  compositionIdInput: CompositionId | undefined,
  next: (owner: LineOwner) => KeyTrack | undefined,
): void {
  const { store } = ctx.require(projectRef);
  const owner = lineOwner(ctx, store.getState(), who, compositionIdInput);
  const line = next(owner);
  ctx.mutate(store, (draft) => owner.write(draft, line));
}

const WHO =
  'an audio track\'s volume line, or the master\'s ("target": a track id or "master", with "compositionId" for the master of another composition than your open one)';

/** Adds a point to a volume line (a track's or the master's), or updates the one on that frame. */
export const setLineKey = defineCommand({
  id: "sound.setLineKey",
  label: "Set volume line point",
  description: `Writes a point on ${WHO}: at "at" (timeline microseconds) the volume is "db" (-60 to 12). A point on that frame is updated; otherwise one is added, easing like the one before it unless "ease" is given ({kind:"linear"}, {kind:"hold"}, {kind:"bezier",x1,y1,x2,y2} or {kind:"named",name:"bounce"|"elastic"}). The line holds its first level before the first point and its last after the last, and the fader adds to it. Moving or splitting clips never moves it. Fails with sound.not_audio, sound.track_not_found and composition.not_found.`,
  undoable: true,
  input: z.object({ target, compositionId, at, db: volumeDbSchema, ease: keyEase.optional() }),
  run(ctx, input) {
    editLine(ctx, input.target, input.compositionId, ({ line, tolerance }) =>
      writeKey(line ?? EMPTY_LINE, input.at, input.db, tolerance, input.ease),
    );
  },
});

/** Moves points of a volume line in time and level. */
export const moveLineKeys = defineCommand({
  id: "sound.moveLineKeys",
  label: "Move volume line points",
  description: `Moves points of ${WHO} (by key id) by "delta" microseconds and "deltaDb" decibels, all together. A moved point replaces an unmoved one it lands on. Fails with sound.no_line, sound.key_not_found and sound.invalid_value (a time before 0 or a level outside -60 to 12), changing nothing.`,
  undoable: true,
  input: z.object({
    target,
    compositionId,
    keyIds: z.array(z.string()).min(1),
    delta: z.number().int(),
    deltaDb: z.number(),
  }),
  run(ctx, { target: who, compositionId: comp, keyIds, delta, deltaDb }) {
    editLine(ctx, who, comp, (owner) => {
      const line = requireLine(owner, who);
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
      return moveTrackKeys(levelled, moves, owner.tolerance);
    });
  },
});

/** Removes points from a volume line. */
export const removeLineKeys = defineCommand({
  id: "sound.removeLineKeys",
  label: "Remove volume line points",
  description: `Removes points (by key id) from ${WHO}. Removing the last one removes the line. Fails with sound.no_line and sound.key_not_found, changing nothing.`,
  undoable: true,
  input: z.object({ target, compositionId, keyIds: z.array(z.string()).min(1) }),
  run(ctx, { target: who, compositionId: comp, keyIds }) {
    editLine(ctx, who, comp, (owner) => {
      const line = requireLine(owner, who);
      requireKeys(line, keyIds);
      return withoutKeys(line, new Set(keyIds));
    });
  },
});

const points = z.array(z.object({ at, db: volumeDbSchema }));

/** Replaces the part of a volume line between two times with points. */
export const writePass = defineCommand({
  id: "sound.writePass",
  label: "Write volume line",
  description: `Replaces the points of ${WHO} from "from" to "to" (timeline microseconds, both included) with "points" ({at, db}, each inside that span, db -60 to 12); points outside the span stay as they were, and the line outside it plays as before: a point 1 microsecond before "from" and 1 after "to" holds the level it had there (none where a point already sits), so the change is a step at the span's edges. The line runs straight from each written point to the next. With no points the span is cleared. This is one stroke of drawing or of a recorded fader pass. Fails with sound.line_range (a point outside the span or from after to), sound.not_audio and sound.track_not_found (a track), and composition.not_found (the master of a composition that isn't there), changing nothing.`,
  undoable: true,
  input: z.object({ target, compositionId, from: at, to: at, points }),
  run(ctx, { target: who, compositionId: comp, from, to, points: written }) {
    editLine(ctx, who, comp, ({ line }) => {
      if (from > to || written.some((point) => point.at < from || point.at > to)) {
        throw new CommandFailure(
          "sound.line_range",
          `Every point must sit between from (${from}) and to (${to}), and from must not be after to.`,
        );
      }
      const keys = written.map((point) => ({ t: point.at, value: point.db }));
      return writeSpan(line ?? EMPTY_LINE, from, to, keys, 0);
    });
  },
});

const span = z.object({ from: at, to: at, points });

/** Replaces several stretches of a volume line at once, leaving what's between them alone. */
export const writePasses = defineCommand({
  id: "sound.writePasses",
  label: "Write volume line",
  description: `Replaces several stretches of ${WHO} in one step, each as sound.writePass does: "spans" is a list of {from, to, points} (timeline microseconds, points {at, db} inside their span, db -60 to 12). Points between the spans stay as they were, ids and eases included. A fader pass that went round a loop or jumped ahead writes this way. Fails like sound.writePass: sound.line_range, sound.not_audio, sound.track_not_found and composition.not_found, changing nothing.`,
  undoable: true,
  input: z.object({ target, compositionId, spans: z.array(span).min(1) }),
  async run(ctx, { target: who, compositionId: comp, spans }) {
    for (const { from, to, points: written } of spans) {
      await ctx.execute(writePass, {
        target: who,
        ...(comp !== undefined && { compositionId: comp }),
        from,
        to,
        points: written,
      });
    }
  },
});

/** Every volume-line command, for the module. */
export const soundLineCommands = [setLineKey, moveLineKeys, removeLineKeys, writePass, writePasses];
