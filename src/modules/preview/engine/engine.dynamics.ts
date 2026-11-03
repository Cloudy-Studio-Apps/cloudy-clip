import type { DynamicsNodes } from "./engine.types";
import workletUrl from "./dynamics.worklet.ts?worker&url";

/**
 * Loads the dynamics worklet into a context, once, in the background. `onChange` is called when
 * it becomes ready or fails, so the buses rebuild their chains; `onError` once, when it can't load,
 * a node can't be made or a processor fails later (`onprocessorerror`). From then on no node is
 * made and every chain passes its dynamics dry, so playback never breaks.
 */
export function createDynamicsNodes(
  context: BaseAudioContext,
  onChange: () => void,
  onError: (error: unknown) => void,
): DynamicsNodes {
  let state: DynamicsNodes["state"] = "loading";
  let closed = false;
  const fail = (error: unknown) => {
    if (closed || state === "failed") return;
    state = "failed";
    onError(error);
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
