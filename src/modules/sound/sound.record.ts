import { createStore } from "zustand/vanilla";
import { createLogger, LOCAL_ACTOR, MICROS_PER_SECOND, notify, toAppError } from "@/core";
import { pause, peakToDb, play, setLoop } from "@/modules/preview";
import type { TrackId } from "@/modules/project";
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
 * The recorder of one kernel: the microphone (`openCapture`) into a WAV in `Recordings` beside
 * the project (`sound_record_begin` / `sound_record_write`, a quarter of a second at a time). On
 * stop the file is read (`media.prepareFile`) outside the bus, then placed with
 * `sound.placeRecording`: onto the armed track, or onto a new Voice track made in the same undo
 * step (then armed) when the take started with none. The take starts where playback starts and runs on past the
 * composition's end. The loop is off while it records (playback runs on through its end) and set
 * again after; audio scrub is silenced while the microphone is open. Failures are told with the
 * file's path, so a take is never lost silently.
 */
export function createRecorder(deps: RecorderDeps): Recorder {
  const { bus, preview, project, media, workspace, view } = deps;
  const { playback } = preview;
  const state = createStore<RecorderState>(() => IDLE);
  let take: LiveTake | null = null;

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

  // The worklet hands samples over only from `keep()` until it's flushed.
  const onBlock = (t: LiveTake) => (block: Float32Array) => {
    const { pcm, peak } = toPcm16(block);
    t.level = peakToDb(peak);
    t.chunks.push(pcm);
    t.chunked += pcm.length;
    t.samples += pcm.length;
    if (t.keeping && t.chunked >= t.rate * SEND_SECONDS) send(t, false);
  };

  /** Closes a take that never kept a sample: its empty file is deleted. */
  const drop = async (t: LiveTake) => {
    await restore(t);
    await t.capture?.stop();
    if (t.file) await writeTake(t.file.id, NOTHING, true).catch((e) => log.warn("Drop", e));
    end(t);
  };

  /** Gives back what the take held: scrub, and the loop if its composition is still open. */
  const restore = async (t: LiveTake) => {
    t.releaseScrub();
    const loop = t.loop;
    t.loop = null;
    const here = project.view.openFor(LOCAL_ACTOR) === t.compositionId;
    if (loop && here && playback.getLoop() === null) {
      const set = await bus.run(setLoop, { range: loop });
      if (!set.ok) log.warn("The loop couldn't be set again", set.error);
    }
  };

  /** The folder of the project, or the one a project without a file yet will be saved in. */
  const projectFolder = async () => {
    const { path } = workspace.session.getState();
    return path === null ? workspace.folder() : folderOf(path);
  };

  async function start(trackId: TrackId | null): Promise<void> {
    if (take) return;
    const track = trackId === null ? undefined : project.store.getState().tracks[trackId];
    if (trackId !== null && !canArm(track)) {
      notify("error", "Recording goes onto an audio track that isn't muted.");
      return;
    }
    // Without a track, the take goes onto a new Voice track in the open composition.
    const compositionId = track?.compositionId ?? project.view.openFor(LOCAL_ACTOR);
    if (compositionId === null) {
      notify("error", "Open a composition to record into.");
      return;
    }
    const t: LiveTake = {
      trackId,
      at: 0,
      keeping: false,
      ending: false,
      finishing: null,
      compositionId,
      loop: null,
      releaseScrub: preview.holdScrub(),
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
      t.file = await beginTake(await projectFolder(), takeStem(new Date()), t.rate);
    } catch (error) {
      log.warn("Recording couldn't start", error);
      notify("error", startFailure(error));
      return drop(t);
    }
    // While the take records, playback runs on through the loop's end instead of wrapping.
    t.loop = playback.getLoop();
    if (t.loop && !t.ending) await bus.run(setLoop, { range: null });
    // An empty timeline doesn't play; the take is recorded all the same.
    if (!t.ending) await bus.run(play, {});
    if (t.ending) return drop(t);
    t.at = playback.getTime();
    t.capture.keep();
    t.keeping = true;
    state.setState({ status: "recording", at: t.at });
  }

  async function finish(t: LiveTake, pauseToo: boolean): Promise<void> {
    t.keeping = false;
    state.setState({ status: "stopping" });
    try {
      if (pauseToo && playback.isPlaying()) {
        const paused = await bus.run(pause, {});
        if (!paused.ok) log.warn("Pause", paused.error);
      }
      await t.capture?.stop();
      send(t, true);
      await t.writes;
      await place(t);
    } finally {
      await restore(t).catch((e) => log.warn("Restore", e));
      // Until the clip is there, the take stays drawn on its lane.
      end(t);
    }
  }

  /** Reads and places what a stopped take wrote, or tells the user why not, naming the file. */
  async function place(t: LiveTake): Promise<void> {
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
    const unplaced = (why: string) =>
      notify(
        "error",
        `The recording is saved as ${path}, but it couldn't be placed (${why}). Import it from the Media page.`,
      );
    // Read outside the bus, so placing never holds every other command while the file is probed.
    const probe = await media.prepareFile(path).catch((error: unknown) => {
      unplaced(reason(error));
      return null;
    });
    if (probe === null) return;
    if (probe?.status !== "ready") return unplaced(probe?.error ?? "its length couldn't be read");
    const onto = t.trackId === null ? { compositionId: t.compositionId } : { trackId: t.trackId };
    const placed = await bus.run(placeRecording, { ...onto, path, at: t.at });
    if (!placed.ok) return unplaced(reason(placed.error));
    if (t.trackId === null) {
      // The new Voice track: the take stays drawn on its lane until it ends, and it's armed.
      state.setState({ trackId: placed.value.trackId });
      view.setState({ armed: placed.value.trackId });
    }
  }

  function stop({ pause: pauseToo = true }: { pause?: boolean } = {}): Promise<void> {
    const t = take;
    if (!t) return Promise.resolve();
    if (t.finishing) return t.finishing;
    if (t.ending) return Promise.resolve();
    t.ending = true;
    // Still starting: `start` sees `ending` and closes the take.
    if (!t.keeping) return Promise.resolve();
    t.finishing = finish(t, pauseToo);
    return t.finishing;
  }

  return {
    state,
    start,
    stop,
    arm(armed) {
      if (!take) view.setState({ armed });
    },
    level: () => (take?.keeping ? take.level : -Infinity),
    length: () => (take?.rate ? Math.round((take.samples / take.rate) * MICROS_PER_SECOND) : 0),
  };
}
