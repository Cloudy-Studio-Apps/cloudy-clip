import { createStore } from "zustand/vanilla";
import { followPageLeave, LOCAL_ACTOR, notify, type Micros } from "@/core";
import {
  automationKey,
  clampDb,
  lineDb,
  lineFader,
  passSpans,
  returnToLine,
} from "./logic/automation";
import { writePasses } from "./sound.line.commands";
import { followCompositionSwitch } from "./sound.leave";
import { SOUND_PAGE } from "./sound.ref";
import type {
  AutomationDeps,
  AutomationMode,
  AutomationPass,
  AutomationState,
  AutomationWriter,
  LineTarget,
} from "./sound.line.types";

/** A playhead this far past the last written frame has jumped: the next lap starts there (µs). */
const JUMP: Micros = 500_000;

/**
 * Creates the automation writer of one kernel (see `AutomationWriter`), for tracks and the master
 * of the open composition alike (a `LineTarget`). A pass keeps the target's
 * line as it was when it began (`snapshot`) and writes relative to it: first the line's own level
 * (so the line before it stays as it was), then, each frame while playing, the line raised or
 * lowered by how far the fader is from the track's volume. A seek or the loop going round starts
 * another lap of the same pass, never a send, so a looped Latch writes the same change each lap
 * rather than adding it up. Touch's release returns to the line (its own levels, its curve kept up
 * to the next key) and writes nothing until the next press, which starts another lap of the same
 * pass. The whole pass is one `sound.writePasses` (a span per stretch it wrote, what it skipped
 * left alone), sent once when it ends (playback stopping, for Touch too); a pass in which the
 * fader never left its place sends nothing. A change to the track's line from anywhere else while
 * a pass runs (an undo, `sound.switchMix`, an agent's edit) ends the pass and sends nothing: what
 * it recorded was written against a line that is gone, and sending it would write over the new one. While it runs the fader's level is heard
 * through `previewMix` over the unchanged line; once its command has landed, the saved mix plays.
 */
export function createAutomation(deps: AutomationDeps): AutomationWriter {
  const { bus, preview, project, workspace, pages, view } = deps;
  const { playback } = preview;
  const state = createStore<AutomationState>()(() => ({ writing: [] }));
  const passes = new Map<LineTarget, AutomationPass>();

  const modeOf = (target: LineTarget, compositionId = project.view.openFor(LOCAL_ACTOR)) =>
    view.getState().automation[automationKey(target, compositionId)] ?? "read";
  /** The target's line and fader now; the master's of `compositionId`, default the open one. */
  const faderOf = (target: LineTarget, compositionId = project.view.openFor(LOCAL_ACTOR)) =>
    lineFader(project.store.getState(), target, compositionId);
  const publish = () => state.setState({ writing: [...passes.keys()] });

  /** Starts a pass with the target's line as it is now; false when the target is gone. */
  const begin = (trackId: LineTarget, mode: AutomationMode, level: number) => {
    const compositionId = project.view.openFor(LOCAL_ACTOR);
    const fader = faderOf(trackId, compositionId);
    if (!fader) return false;
    passes.set(trackId, {
      mode,
      compositionId,
      offset: fader.volumeDb,
      level,
      held: true,
      snapshot: fader.line,
      laps: [],
      changed: false,
    });
    publish();
    return true;
  };

  /** Ends a target's pass, sending nothing, and lets the saved mix play. */
  const drop = (trackId: LineTarget) => {
    if (!passes.delete(trackId)) return;
    publish();
    preview.sound.previewMix(trackId, null);
  };

  /** Ends a target's pass and sends it. */
  const end = async (trackId: LineTarget): Promise<void> => {
    const pass = passes.get(trackId);
    if (!pass) return;
    passes.delete(trackId);
    publish();
    const spans = passSpans(pass.laps).filter((span) => span.to > span.from);
    if (pass.changed && spans.length > 0 && faderOf(trackId, pass.compositionId)) {
      const where =
        trackId === "master" && pass.compositionId !== null
          ? { compositionId: pass.compositionId }
          : {};
      const result = await bus.run(writePasses, { target: trackId, ...where, spans });
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
      // Touch let go: back on the line, nothing written until the next press.
      if (pass.mode === "touch" && !pass.held) continue;
      let lap = pass.laps[pass.laps.length - 1];
      const last = lap?.[lap.length - 1];
      if (!lap || !last) {
        // The first frame of a lap: the line's own level, so the line before it stays.
        const start = { at: time, db: lineDb(pass.snapshot, time) };
        if (lap) lap.push(start);
        else pass.laps.push([start]);
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
    followPageLeave(pages, SOUND_PAGE, () => void finish()),
    followCompositionSwitch(project, () => void finish()),
    workspace.beforeLeave({ finish, blocking: () => null }),
    // The line changed under a pass, not by it (a pass is gone before it sends): drop the pass.
    project.store.subscribe((now) => {
      for (const [trackId, pass] of passes) {
        if (lineFader(now, trackId, pass.compositionId)?.line !== pass.snapshot) drop(trackId);
      }
    }),
    // A mode changed under a pass ends it.
    view.subscribe(() => {
      for (const [trackId, pass] of passes) {
        if (modeOf(trackId, pass.compositionId) !== pass.mode) void end(trackId);
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
      // Touch pressed again in the same play: another lap, starting on the line.
      if (pass.mode === "touch" && !pass.held) pass.laps.push([]);
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
      if (pass.mode !== "touch") return;
      // Touch returns to the line: its own levels from here, the pass sent at stop.
      const lap = pass.laps[pass.laps.length - 1];
      const last = lap?.[lap.length - 1];
      if (lap && last) {
        lap.push(...returnToLine(pass.snapshot, Math.max(playback.getTime(), last.at + 1)));
      }
      preview.sound.previewMix(trackId, null);
    },
    level: (trackId) => {
      const pass = passes.get(trackId);
      return pass && (pass.held || pass.mode !== "touch") ? pass.level : null;
    },
    finish,
    dispose() {
      offs.forEach((off) => off());
      passes.clear();
    },
  };
}
