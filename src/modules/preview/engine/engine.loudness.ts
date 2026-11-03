import type { LoudnessMessage, LoudnessReading } from "../preview.types";
import { NO_LOUDNESS } from "../logic/loudness";
import type { LoudnessTap } from "./engine.types";
import workletUrl from "./loudness.worklet.ts?worker&url";

/**
 * Loads the loudness worklet into a context and listens to `source` with it. Rejects when the
 * worklet can't load or start; the caller reports that once and the rest of the graph goes on.
 * The node is connected on to the destination only so the context keeps running it: it writes
 * no output, so nothing is heard.
 */
export async function createLoudnessTap(
  context: AudioContext,
  source: AudioNode,
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
  node.port.onmessage = (event: MessageEvent<LoudnessMessage>) => {
    if (event.data.generation === generation) latest = event.data.reading;
  };
  source.connect(node);
  node.connect(context.destination);
  return {
    read: () => latest,
    reset() {
      generation += 1;
      // The worklet posts again within 100 ms; until then there's nothing, not the old reading.
      latest = NO_LOUDNESS;
      node.port.postMessage({ reset: generation });
    },
    dispose() {
      node.port.onmessage = null;
      source.disconnect(node);
      node.disconnect();
    },
  };
}
