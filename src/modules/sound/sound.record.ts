import { createStore } from "zustand/vanilla";
import { CommandFailure, createLogger, MICROS_PER_SECOND, notify, toAppError } from "@/core";
import { pause, peakToDb, play } from "@/modules/preview";
import type { TrackId } from "@/modules/project";
import type { LeaveRun } from "@/modules/workspace";
import { canArm, folderOf, joinChunks, startFailure, takeStem, toPcm16 } from "./logic/record";
import { openCapture } from "./sound.record.capture";
import { placeRecording } from "./sound.record.commands";
import { beginTake, writeTake } from "./sound.service";
import type { LiveTake, Recorder, RecorderDeps, RecorderState } from "./sound.types";

const log = createLogger("sound.record");

/** How much is gathered before it goes to disk, in seconds. */
const SEND_SECONDS = 0.25;
const IDLE: RecorderState = { status: "idle", trackId: null, at: 0 };
const NOTHING = new Uint8Array(0);
const reason = (error: unknown) => toAppError(error).message.replace(/\.$/, "");

/**
 * The recorder of one kernel: the microphone (`openCapture`) into a WAV beside the project
 * (`sound_record_begin` / `sound_record_write`, a quarter of a second at a time), placed on stop
 * with `sound.placeRecording`. The take starts where playback starts and runs on past the
 * composition's end; a loop wrapping playback doesn't wrap the take. Failures are told with the
 * file's path, so a take is never lost silently.
 */
export function createRecorder({ bus, playback, project, session }: RecorderDeps): Recorder {
  const state = createStore<RecorderState>(() => IDLE);
  let take: LiveTake | null = null;

  const viaBus: LeaveRun = async (command, input) => {
    const result = await bus.run(command, input);
    if (!result.ok) throw new CommandFailure(result.error.code, result.error.message);
    return result.value;
  };

  const end = (t: LiveTake) => {
    if (take !== t) return;
    take = null;
    state.setState(IDLE);
  };

  /** Queues what was gathered for the disk, after the writes before it. */
  const send = (t: LiveTake, done: boolean) => {
    const file = t.file;
    if (!file) return;
    const bytes = t.chunked > 0 ? joinChunks(t.chunks, t.chunked) : NOTHING;
    t.chunks = [];
    t.chunked = 0;
    t.writes = t.writes.then(async () => {
      try {
        t.written = await writeTake(file.id, bytes, done);
      } catch (error) {
        t.failure ??= error;
        // A full disk ends the take; what got written is placed.
        if (!done) void stop();
      }
    });
  };

  const onBlock = (t: LiveTake) => (block: Float32Array) => {
    if (!t.keeping) return;
    const { pcm, peak } = toPcm16(block);
    t.level = peakToDb(peak);
    t.chunks.push(pcm);
    t.chunked += pcm.length;
    t.samples += pcm.length;
    if (t.chunked >= t.rate * SEND_SECONDS) send(t, false);
  };

  /** Closes a take that never kept a sample: its empty file is deleted. */
  const drop = async (t: LiveTake) => {
    t.capture?.stop();
    if (t.file) await writeTake(t.file.id, NOTHING, true).catch((e) => log.warn("Drop", e));
    end(t);
  };

  async function start(trackId: TrackId): Promise<void> {
    if (take) return;
    if (!canArm(project.store.getState().tracks[trackId])) {
      notify("error", "Recording goes onto an audio track that isn't muted. Arm one first.");
      return;
    }
    const t: LiveTake = {
      trackId,
      at: 0,
      keeping: false,
      ending: false,
      capture: null,
      file: null,
      rate: 0,
      chunks: [],
      chunked: 0,
      samples: 0,
      level: -Infinity,
      writes: Promise.resolve(),
      written: null,
      failure: null,
    };
    take = t;
    state.setState({ status: "starting", trackId, at: 0 });
    try {
      t.capture = await openCapture(onBlock(t));
      t.rate = t.capture.sampleRate;
      const { path } = session.getState();
      const folder = path === null ? null : folderOf(path);
      t.file = await beginTake(folder, takeStem(new Date()), t.rate);
    } catch (error) {
      log.warn("Recording couldn't start", error);
      notify("error", startFailure(error));
      return drop(t);
    }
    // An empty timeline doesn't play; the take is recorded all the same.
    if (!t.ending) await bus.run(play, {});
    if (t.ending) return drop(t);
    t.at = playback.getTime();
    t.keeping = true;
    state.setState({ status: "recording", at: t.at });
  }

  async function finish(t: LiveTake, run: LeaveRun): Promise<void> {
    t.keeping = false;
    state.setState({ status: "stopping" });
    t.capture?.stop();
    send(t, true);
    try {
      if (playback.isPlaying()) await run(pause, {}).catch((e) => log.warn("Pause", e));
      await t.writes;
      await place(t, run);
    } finally {
      // Until the clip is there, the take stays drawn on its lane.
      end(t);
    }
  }

  /** Places what a stopped take wrote, or tells the user why not, naming the file. */
  async function place(t: LiveTake, run: LeaveRun): Promise<void> {
    const path = t.written ? t.written.path : (t.file?.path ?? null);
    const samples = t.written?.samples ?? 0;
    if (t.failure) {
      const where = path ? ` What was recorded is in ${path}.` : "";
      notify("error", `Recording stopped (${reason(t.failure)}).${where}`);
    }
    if (path === null || samples === 0) {
      if (!t.failure) notify("info", "Nothing was recorded.");
      return;
    }
    try {
      await run(placeRecording, { trackId: t.trackId, path, at: t.at });
    } catch (error) {
      notify(
        "error",
        `The recording is saved as ${path}, but it couldn't be placed (${reason(error)}). Import it from the Media page.`,
      );
    }
  }

  function stop(run: LeaveRun = viaBus): Promise<void> {
    const t = take;
    if (!t || t.ending) return Promise.resolve();
    t.ending = true;
    // Still starting: `start` sees `ending` and closes the take.
    if (!t.keeping) return Promise.resolve();
    return finish(t, run);
  }

  return {
    state,
    start,
    stop,
    level: () => (take?.keeping ? take.level : -Infinity),
    length: () => (take?.rate ? Math.round((take.samples / take.rate) * MICROS_PER_SECOND) : 0),
  };
}
