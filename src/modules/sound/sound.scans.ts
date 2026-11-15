import type { AgentScans } from "./sound.tools.types";

/** Creates the per-kernel record of the scans agents started, one abort per caller. */
export function createAgentScans(): AgentScans {
  const controllers = new Map<string, AbortController>();
  return {
    signalOf(caller) {
      let controller = controllers.get(caller);
      if (!controller || controller.signal.aborted) {
        controller = new AbortController();
        controllers.set(caller, controller);
      }
      return controller.signal;
    },
    cancel(caller) {
      controllers.get(caller)?.abort();
      controllers.delete(caller);
    },
  };
}
