import { createStore } from "zustand/vanilla";
import { notify, type Micros } from "@/core";
import { trackMixOf, type TrackId } from "@/modules/project";
import { clampDb, lineDb, thinLevels } from "./logic/automation";
import { writePass } from "./sound.line.commands";
import { followCompositionSwitch, followSoundPageLeave } from "./sound.leave";
import type {
  AutomationDeps,
  AutomationPass,
  AutomationState,
  AutomationWriter,
} from "./sound.types";

/** A playhead this far past the last written frame has jumped: the pass ends there (µs). */
const JUMP: Micros = 500_000;

/**
 * Creates the automation writer of one kernel (see `AutomationWriter`). A pass starts at the
 * line's own level, so the line before it stays as it was, then writes, each frame while playing,
 * the line raised or lowered by how far the fader is from where it was. Touch's release writes the
 * line's level again at that moment, so the line after it stays as it was. A pass in which the
 * fader never left its place sends nothing. While a pass runs, the fader's level is heard through
 * `previewMix`; once its command has landed, the saved mix plays again.
 */
export function createAutomation(deps: AutomationDeps): AutomationWriter {
  const { bus, preview, project, workspace, pages, view } = deps;
  const { playback } = preview;
  const state = createStore<AutomationState>()(() => ({ writing: [] }));
  const passes = new Map<TrackId, AutomationPass>();

  const modeOf = (trackId: TrackId) => view.getState().automation[trackId] ?? "read";
  const trackOf = (trackId: TrackId) => project.store.getState().tracks[trackId];
  const base = (trackId: TrackId, at: Micros) => lineDb(trackOf(trackId)?.mix?.volumeLine, at);
  const publish = () => state.setState({ writing: [...passes.keys()] });

  const begin = (trackId: TrackId, from: Omit<AutomationPass, "points" | "changed">) => {
    passes.set(trackId, { ...from, points: [], changed: false });
    publish();
  };

  /** Ends a track's pass and sends it; with `returning`, the line's own level closes it (Touch). */
  const end = async (trackId: TrackId, returning = false): Promise<void> => {
    const pass = passes.get(trackId);
    if (!pass) return;
    passes.delete(trackId);
    publish();
    const last = pass.points[pass.points.length - 1];
    if (returning && last) {
      const at = Math.max(playback.getTime(), last.at + 1);
      pass.points.push({ at, db: base(trackId, at) });
    }
    const first = pass.points[0];
    const final = pass.points[pass.points.length - 1];
    if (pass.changed && first && final && final.at > first.at && trackOf(trackId)) {
      const result = await bus.run(writePass, {
        trackId,
        from: first.at,
        to: final.at,
        points: thinLevels(pass.points),
      });
      if (!result.ok) notify("error", `The fader pass wasn't written: ${result.error.message}`);
    }
    // A new pass, or a fader still held, keeps playing its own level.
    if (!passes.has(trackId)) preview.sound.previewMix(trackId, null);
  };

  const finish = async () => {
    await Promise.all([...passes.keys()].map((trackId) => end(trackId)));
  };

  const sample = (time: Micros) => {
    if (passes.size === 0 || !playback.isPlaying()) return;
    for (const [trackId, pass] of passes) {
      let current = pass;
      const last = current.points[current.points.length - 1];
      if (last && (time < last.at || time > last.at + JUMP)) {
        // A seek or the loop going round: what was written is one pass, the rest another.
        void end(trackId);
        begin(trackId, {
          mode: pass.mode,
          offset: pass.offset,
          level: pass.level,
          held: pass.held,
        });
        current = passes.get(trackId)!;
      }
      const previous = current.points[current.points.length - 1];
      if (previous?.at === time) continue;
      const line = base(trackId, time);
      if (!previous) {
        current.points.push({ at: time, db: line });
        continue;
      }
      if (current.level !== current.offset) current.changed = true;
      current.points.push({ at: time, db: clampDb(line + current.level - current.offset) });
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
      const track = trackOf(trackId);
      if (mode === "read" || !track || !playback.isPlaying()) return false;
      const pass = passes.get(trackId);
      if (pass) {
        pass.held = true;
        pass.level = db;
        return true;
      }
      begin(trackId, { mode, offset: trackMixOf(track).volumeDb, level: db, held: true });
      return true;
    },
    move(trackId, db) {
      const pass = passes.get(trackId);
      if (!pass) return;
      pass.level = db;
      preview.sound.previewMix(trackId, { volumeDb: db });
    },
    release(trackId) {
      const pass = passes.get(trackId);
      if (!pass) return;
      pass.held = false;
      if (pass.mode === "touch") void end(trackId, true);
    },
    level: (trackId) => passes.get(trackId)?.level ?? null,
    finish,
    dispose() {
      offs.forEach((off) => off());
      void finish();
    },
  };
}
