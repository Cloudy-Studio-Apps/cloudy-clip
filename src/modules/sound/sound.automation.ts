import { createStore } from "zustand/vanilla";
import { notify, type Micros } from "@/core";
import { trackMixOf, type TrackId } from "@/modules/project";
import { clampDb, lineDb, passLevels, returnToLine } from "./logic/automation";
import { writePass } from "./sound.line.commands";
import { followCompositionSwitch, followSoundPageLeave } from "./sound.leave";
import type {
  AutomationDeps,
  AutomationMode,
  AutomationPass,
  AutomationState,
  AutomationWriter,
} from "./sound.types";

/** A playhead this far past the last written frame has jumped: the next lap starts there (µs). */
const JUMP: Micros = 500_000;

/**
 * Creates the automation writer of one kernel (see `AutomationWriter`). A pass keeps the track's
 * line as it was when it began (`snapshot`) and writes relative to it: first the line's own level
 * (so the line before it stays as it was), then, each frame while playing, the line raised or
 * lowered by how far the fader is from the track's volume. A seek or the loop going round starts
 * another lap of the same pass, never a send, so a looped Latch writes the same change each lap
 * rather than adding it up. Touch's release returns to the line (its own levels, its curve kept up
 * to the next key). The whole pass is one `sound.writePass`, sent once when it ends; a pass in
 * which the fader never left its place sends nothing. While it runs the fader's level is heard
 * through `previewMix` over the unchanged line; once its command has landed, the saved mix plays.
 */
export function createAutomation(deps: AutomationDeps): AutomationWriter {
  const { bus, preview, project, workspace, pages, view } = deps;
  const { playback } = preview;
  const state = createStore<AutomationState>()(() => ({ writing: [] }));
  const passes = new Map<TrackId, AutomationPass>();

  const modeOf = (trackId: TrackId) => view.getState().automation[trackId] ?? "read";
  const trackOf = (trackId: TrackId) => project.store.getState().tracks[trackId];
  const publish = () => state.setState({ writing: [...passes.keys()] });

  /** Starts a pass with the track's line as it is now; false when the track is gone. */
  const begin = (trackId: TrackId, mode: AutomationMode, level: number) => {
    const track = trackOf(trackId);
    if (!track) return false;
    passes.set(trackId, {
      mode,
      offset: trackMixOf(track).volumeDb,
      level,
      held: true,
      snapshot: track.mix?.volumeLine,
      laps: [],
      changed: false,
    });
    publish();
    return true;
  };

  /** Ends a track's pass and sends it; with `returning`, it returns to the line (Touch). */
  const end = async (trackId: TrackId, returning = false): Promise<void> => {
    const pass = passes.get(trackId);
    if (!pass) return;
    passes.delete(trackId);
    publish();
    const lap = pass.laps[pass.laps.length - 1];
    const last = lap?.[lap.length - 1];
    if (returning && lap && last) {
      lap.push(...returnToLine(pass.snapshot, Math.max(playback.getTime(), last.at + 1)));
    }
    const points = passLevels(pass.laps, pass.snapshot);
    const first = points[0];
    const final = points[points.length - 1];
    if (pass.changed && first && final && final.at > first.at && trackOf(trackId)) {
      const result = await bus.run(writePass, { trackId, from: first.at, to: final.at, points });
      if (!result.ok) notify("error", `The fader pass wasn't written: ${result.error.message}`);
    }
    // A new pass keeps playing its own level.
    if (!passes.has(trackId)) preview.sound.previewMix(trackId, null);
  };

  const finish = async () => {
    await Promise.all([...passes.keys()].map((trackId) => end(trackId)));
  };

  const sample = (time: Micros) => {
    if (passes.size === 0 || !playback.isPlaying()) return;
    for (const pass of passes.values()) {
      let lap = pass.laps[pass.laps.length - 1];
      const last = lap?.[lap.length - 1];
      if (!lap || !last) {
        // The first frame: the line's own level, so the line before the pass stays.
        pass.laps.push([{ at: time, db: lineDb(pass.snapshot, time) }]);
        continue;
      }
      if (time === last.at) continue;
      if (time < last.at || time > last.at + JUMP) {
        // A seek or the loop going round: another lap, carrying on at the fader's level.
        lap = [];
        pass.laps.push(lap);
      }
      if (pass.level !== pass.offset) pass.changed = true;
      lap.push({ at: time, db: clampDb(lineDb(pass.snapshot, time) + pass.level - pass.offset) });
    }
  };

  const offs = [
    playback.onTime(sample),
    playback.onPlayingChange(() => {
      if (!playback.isPlaying()) void finish();
    }),
    followSoundPageLeave(pages, () => void finish()),
    followCompositionSwitch(project, () => void finish()),
    workspace.beforeLeave({ finish, blocking: () => null }),
    // A mode changed under a pass ends it.
    view.subscribe(() => {
      for (const [trackId, pass] of passes) {
        if (modeOf(trackId) !== pass.mode) void end(trackId);
      }
    }),
  ];

  return {
    state,
    press(trackId, db) {
      const mode = modeOf(trackId);
      if (mode === "read" || !playback.isPlaying()) return false;
      const pass = passes.get(trackId);
      if (!pass) return begin(trackId, mode, db);
      pass.held = true;
      pass.level = db;
      return true;
    },
    move(trackId, db) {
      const mode = modeOf(trackId);
      // Playback stopped under the hold, then started again: the hold writes again.
      if (!passes.has(trackId) && mode !== "read" && playback.isPlaying()) {
        begin(trackId, mode, db);
      }
      const pass = passes.get(trackId);
      if (pass) pass.level = db;
      preview.sound.previewMix(trackId, { volumeDb: db });
    },
    release(trackId) {
      const pass = passes.get(trackId);
      if (!pass) {
        // The pass ended under the hold: what was heard since goes back to the saved mix.
        preview.sound.previewMix(trackId, null);
        return;
      }
      pass.held = false;
      if (pass.mode === "touch") void end(trackId, true);
    },
    level: (trackId) => passes.get(trackId)?.level ?? null,
    finish,
    dispose() {
      offs.forEach((off) => off());
      passes.clear();
    },
  };
}
