import { createId, type PatchableStore } from "@/core";
import type { MediaAsset, MediaId, ProjectState } from "@/modules/project";
import { registerFiles } from "./media.service";
import { isProxySettled } from "./media.store";
import type { MediaFiles, MediaState, ProbeQueue } from "./media.types";

/** Keeps the native registry and the probes in step with the files the document names. */
export function createMediaFiles(deps: {
  project: PatchableStore<ProjectState>;
  state: MediaState;
  probes: ProbeQueue;
}): MediaFiles {
  const { project, state, probes } = deps;
  /** Files read ahead of their import, by path. */
  const prepared = new Map<string, MediaAsset>();

  /** Resolves once `ready` holds for the probes, or after `timeoutMs`. */
  const until = (ready: () => boolean, timeoutMs: number) =>
    new Promise<void>((resolve) => {
      if (ready()) return resolve();
      const done = () => {
        clearTimeout(timer);
        stop();
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      const stop = state.probes.subscribe(() => ready() && done());
    });

  const startOver = (id: MediaId, status: "pending" | "missing", error?: string) => {
    probes.forget(id);
    state.replaceProbe(id, { status, ...(error === undefined ? {} : { error }) });
  };

  // Read metadata of every media item in the project (import, redo, opening) once its proxy
  // pipeline has settled.
  const probeAll = () => {
    const { media, mediaOrder } = project.getState();
    for (const id of mediaOrder) {
      const asset = media[id];
      if (!asset) continue;
      const probe = state.getProbe(id);
      if (!probe) state.setProbe(id, { status: "pending" });
      else if (probe.status !== "missing" && isProxySettled(probe.proxy)) probes.enqueue(asset);
    }
  };

  /** Moves an id to its new file. Reset first: proxy events can beat the answer. */
  const moved = async (asset: MediaAsset) => {
    startOver(asset.id, "pending");
    const [outcome] = await registerFiles([{ id: asset.id, path: asset.path }]);
    if (outcome?.status === "error") startOver(asset.id, "missing", outcome.error.message);
  };

  return {
    follow() {
      probeAll();
      const stopProject = project.subscribe((next, previous) => {
        if (next.mediaOrder !== previous.mediaOrder) probeAll();
        if (next.media === previous.media) return;
        for (const asset of Object.values(next.media)) {
          const before = previous.media[asset.id];
          if (before && before.path !== asset.path) void moved(asset);
        }
      });
      const stopProbes = state.probes.subscribe(probeAll);
      return () => {
        stopProject();
        stopProbes();
      };
    },
    async prepareFile(path, timeoutMs = 15_000) {
      const id = createId("media");
      state.setProbe(id, { status: "pending" });
      const [outcome] = await registerFiles([{ id, path }]);
      if (!outcome || outcome.status === "error") {
        state.replaceProbe(id, {
          status: "error",
          error: outcome?.error.message ?? "Not imported",
        });
        throw new Error(outcome?.error.message ?? `"${path}" couldn't be read`);
      }
      const asset: MediaAsset = { ...outcome.media };
      const started = Date.now();
      // Probed from its proxy once that pipeline has settled, as an imported file is.
      await until(() => isProxySettled(state.getProbe(id)?.proxy), timeoutMs);
      probes.enqueue(asset);
      const probe = await state.waitForProbe(id, Math.max(0, timeoutMs - (Date.now() - started)));
      prepared.set(path, asset);
      return probe;
    },
    takePrepared(path) {
      const asset = prepared.get(path);
      prepared.delete(path);
      return asset;
    },
    async restore(assets) {
      for (const { id } of assets) {
        if (state.getProbe(id)?.status === "missing") startOver(id, "pending");
      }
      const outcomes = await registerFiles(assets.map(({ id, path }) => ({ id, path })));
      const missing: MediaAsset[] = [];
      for (const outcome of outcomes) {
        if (outcome.status !== "error") continue;
        const asset = assets.find(({ id }) => id === outcome.id);
        if (asset) missing.push(asset);
        startOver(outcome.id, "missing", outcome.error.message);
      }
      return missing;
    },
  };
}
