import type { LoudnessCommand, LoudnessMessage, LoudnessReading } from "../preview.types";
import { NO_LOUDNESS } from "../logic/loudness";
import type { LoudnessTap } from "./engine.types";
import workletUrl from "./loudness.worklet.ts?worker&url";

/**
 * Loads the loudness worklet into a context and listens to `source` with it. Rejects when the
 * worklet can't load or start; the caller reports that once and the rest of the graph goes on.
 * `onError` is called once if the processor fails later, after which the tap reads null.
 * The node is connected on to the destination only so the context keeps running it: it writes
 * no output, so nothing is heard. It starts inactive: it measures only once `setActive(true)`.
 */
export async function createLoudnessTap(
  context: AudioContext,
  source: AudioNode,
  onError: (error: unknown) => void,
): Promise<LoudnessTap> {
  await context.audioWorklet.addModule(workletUrl);
  const node = new AudioWorkletNode(context, "loudness", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 2,
    channelCountMode: "explicit",
    outputChannelCount: [2],
  });
  let latest: LoudnessReading | null = null;
  let generation = 0;
  let active = false;
  const post = (command: LoudnessCommand) => node.port.postMessage(command);
  node.port.onmessage = (event: MessageEvent<LoudnessMessage>) => {
    if (event.data.generation === generation) latest = event.data.reading;
  };
  let failed = false;
  // The processor threw: its readings stop, so don't keep showing the last one.
  node.onprocessorerror = (event) => {
    if (failed) return;
    failed = true;
    latest = null;
    onError(event);
  };
  source.connect(node);
  node.connect(context.destination);
  return {
    read: () => (failed ? null : latest),
    reset() {
      if (failed) return;
      generation += 1;
      // The worklet posts again within 100 ms; until then there's nothing, not the old reading.
      latest = NO_LOUDNESS;
      post({ reset: generation });
    },
    setActive(next) {
      if (failed || next === active) return;
      active = next;
      post({ active });
    },
    dispose() {
      node.port.onmessage = null;
      node.onprocessorerror = null;
      source.disconnect(node);
      node.disconnect();
    },
  };
}
