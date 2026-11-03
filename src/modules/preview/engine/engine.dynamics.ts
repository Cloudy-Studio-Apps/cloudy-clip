import { createLogger, notify } from "@/core";
import type { DynamicsNodes } from "./engine.types";
import workletUrl from "./dynamics.worklet.ts?worker&url";

const log = createLogger("preview.engine");

/** Tells the user, once per engine, that dynamics effects aren't heard in the preview. */
function report(error: unknown): void {
  log.warn("The effects worklet isn't available", error);
  notify(
    "error",
    "The preview can't run the compressor, gate, de-esser, limiter or ducking here, so they aren't heard while you edit. Playback and EQ are unaffected.",
  );
}

/**
 * Loads the dynamics worklet into a context, once per engine, in the background. `onChange` is
 * called when it becomes ready or fails, so the buses rebuild their chains. When it can't load, a
 * node can't be made or a processor fails later (`onprocessorerror`), the user is told once; from
 * then on no node is made and every chain passes its dynamics dry, so playback never breaks.
 */
export function createDynamicsNodes(
  context: BaseAudioContext,
  onChange: () => void,
): DynamicsNodes {
  let state: DynamicsNodes["state"] = "loading";
  let closed = false;
  const fail = (error: unknown) => {
    if (closed || state === "failed") return;
    state = "failed";
    report(error);
    onChange();
  };
  // A webview without worklets has no `audioWorklet`: that is a failure like any other.
  const loading = new Promise<void>((resolve) =>
    resolve(context.audioWorklet.addModule(workletUrl)),
  );
  loading.then(() => {
    if (closed || state !== "loading") return;
    state = "ready";
    onChange();
  }, fail);

  return {
    get state() {
      return state;
    },
    create(effect) {
      if (state !== "ready") return null;
      try {
        const node = new AudioWorkletNode(context, "dynamics", {
          numberOfInputs: effect.kind === "duck" ? 2 : 1,
          numberOfOutputs: 1,
          channelCount: 2,
          channelCountMode: "explicit",
          channelInterpretation: "speakers",
          outputChannelCount: [2],
          processorOptions: { effect },
        });
        node.onprocessorerror = fail;
        return node;
      } catch (error) {
        fail(error);
        return null;
      }
    },
    dispose() {
      closed = true;
    },
  };
}
