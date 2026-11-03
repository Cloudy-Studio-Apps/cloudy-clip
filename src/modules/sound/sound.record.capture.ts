import { platformOf, RECORDING_CHECKED } from "./logic/record";
import type { Capture, RecordCommand } from "./sound.types";
import workletUrl from "./sound.record.worklet.ts?worker&url";

/**
 * What is asked of the microphone: the voice as it is. WebKitGTK knows only `echoCancellation`
 * (and turns it on by default); Chromium knows all three.
 */
const RAW_VOICE: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

/** How long stopping waits for the worklet's last samples, in ms. */
const FLUSH_WAIT_MS = 500;

/** Whether this webview can record: a microphone API, on a platform where it was checked. */
export function canRecordHere(): boolean {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
  return RECORDING_CHECKED[platformOf(navigator.userAgent)];
}

/**
 * Opens the microphone and hands every batch of its samples (mono, -1..1) to `onBlock`, from
 * `keep()` on. The samples come at the capture's own `AudioContext` rate (`sampleRate`), never the
 * track's, which WebKitGTK reports as 0. The worklet is bundled as a URL (`?worker&url`) and
 * loaded with `audioWorklet.addModule`, as the preview's loudness and dynamics worklets are.
 * Rejects when the microphone or the worklet can't be had; nothing stays open then. `stop()`
 * hands over the samples still in the worklet, then closes everything, the microphone included
 * (the system stops showing it in use).
 */
export async function openCapture(onBlock: (block: Float32Array) => void): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: RAW_VOICE });
  let context: AudioContext | null = null;
  const close = () => {
    for (const track of stream.getTracks()) track.stop();
    void context?.close();
  };
  try {
    context = new AudioContext();
    // A webview without worklets has no `audioWorklet`: that is a failure like any other.
    await new Promise<void>((resolve) => resolve(context!.audioWorklet.addModule(workletUrl)));
    const node = new AudioWorkletNode(context, "sound-record", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: "explicit",
    });
    let flushed = () => {};
    node.port.onmessage = ({ data }: MessageEvent<Float32Array | "flushed">) => {
      if (data === "flushed") flushed();
      else onBlock(data);
    };
    const tell = (command: RecordCommand) => node.port.postMessage(command);
    // The node goes on to the speakers through a gain of 0 only so the context keeps running it.
    const silent = context.createGain();
    silent.gain.value = 0;
    context
      .createMediaStreamSource(stream)
      .connect(node)
      .connect(silent)
      .connect(context.destination);
    void context.resume();
    return {
      sampleRate: context.sampleRate,
      keep: () => tell({ keep: true }),
      async stop() {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, FLUSH_WAIT_MS);
          flushed = () => {
            clearTimeout(timer);
            resolve();
          };
          tell({ flush: true });
        });
        node.port.onmessage = null;
        close();
      },
    };
  } catch (error) {
    close();
    throw error;
  }
}
