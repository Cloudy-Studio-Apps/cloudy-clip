import type { Capture } from "./sound.types";
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

/**
 * Opens the microphone and hands every batch of its samples (mono, -1..1) to `onBlock`. The
 * samples come at the capture's own `AudioContext` rate (`sampleRate`), never the track's, which
 * WebKitGTK reports as 0. The worklet is bundled as a URL (`?worker&url`) and loaded with
 * `audioWorklet.addModule`, as the preview's loudness and dynamics worklets are. Rejects when the
 * microphone or the worklet can't be had; nothing stays open then. `stop()` closes everything,
 * the microphone included (the system stops showing it in use).
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
    node.port.onmessage = (event: MessageEvent<Float32Array>) => onBlock(event.data);
    // The node goes on to the speakers through a gain of 0 only so the context keeps running it.
    const silent = context.createGain();
    silent.gain.value = 0;
    context
      .createMediaStreamSource(stream)
      .connect(node)
      .connect(silent)
      .connect(context.destination);
    void context.resume();
    const sampleRate = context.sampleRate;
    return {
      sampleRate,
      stop() {
        node.port.onmessage = null;
        close();
      },
    };
  } catch (error) {
    close();
    throw error;
  }
}
