import type { SoundEffect } from "@/modules/project";
import type { DynamicsCommand } from "../preview.types";
import { createEqFilters, createUpmix, setBand } from "./engine.soundnodes";
import type { DynamicsNodes, EffectChain, EffectStage } from "./engine.types";

/** Takes one connection away; it may already be gone with a dropped bus. */
function unplug(from: AudioNode, to: AudioNode): void {
  try {
    from.disconnect(to);
  } catch {
    // Not connected: nothing to undo.
  }
}

/** The six biquads of the clip's EQ, in a row. */
function eqStage(context: BaseAudioContext): EffectStage {
  const filters = createEqFilters(context);
  filters.slice(1).forEach((filter, i) => filters[i]!.connect(filter));
  let shown: SoundEffect | null = null;
  return {
    input: filters[0]!,
    output: filters[filters.length - 1]!,
    update(effect) {
      if (effect.kind !== "eq" || effect === shown) return;
      shown = effect;
      filters.forEach((filter, i) => setBand(filter, effect.bands[i]!, effect.on));
    },
    dispose: () => filters.forEach((filter) => filter.disconnect()),
  };
}

/**
 * One worklet node running a dynamics effect; settings are posted when the effect changes. A
 * duck's second input is the sum of the nodes it listens to, rewired when that list changes.
 */
function dynamicsStage(context: BaseAudioContext, node: AudioWorkletNode): EffectStage {
  let shown: SoundEffect | null = null;
  let key: GainNode | null = null;
  let listened: AudioNode[] = [];
  return {
    input: node,
    output: node,
    update(effect, keyOf) {
      if (effect !== shown) {
        shown = effect;
        node.port.postMessage(effect as DynamicsCommand);
      }
      if (effect.kind !== "duck") return;
      if (!key) {
        key = createUpmix(context);
        key.connect(node, 0, 1);
      }
      const next = effect.listensTo.flatMap((id) => keyOf(id) ?? []);
      if (next.length === listened.length && next.every((n, i) => n === listened[i])) return;
      for (const source of listened) unplug(source, key);
      for (const source of next) source.connect(key);
      listened = next;
    },
    dispose() {
      if (key) for (const source of listened) unplug(source, key);
      key?.disconnect();
      node.onprocessorerror = null;
      node.disconnect();
    },
  };
}

/** What makes a chain different enough to rebuild: the worklet's state and the effects' kinds, order and ids. */
const shapeOf = (effects: readonly SoundEffect[], dynamics: DynamicsNodes) =>
  `${dynamics.state}|${effects.map((effect) => `${effect.kind}:${effect.id}`).join(",")}`;

/**
 * The effects between `from` and `to`, in the user's order. EQ is the clip's six biquads; every
 * dynamics kind is a worklet node, left out (dry) until the worklet is ready, or after it failed.
 * Noise reduction plays a rendered file instead, so it has no node here.
 */
export function createEffectChain(
  context: BaseAudioContext,
  from: AudioNode,
  to: AudioNode,
  dynamics: DynamicsNodes,
): EffectChain {
  let shape = shapeOf([], dynamics);
  let stages: { id: string; stage: EffectStage }[] = [];
  from.connect(to);

  const build = (effects: readonly SoundEffect[]) => {
    from.disconnect();
    for (const { stage } of stages) stage.dispose();
    stages = effects.flatMap((effect) => {
      if (effect.kind === "eq") return [{ id: effect.id, stage: eqStage(context) }];
      if (effect.kind === "denoise") return [];
      const node = dynamics.create(effect);
      return node ? [{ id: effect.id, stage: dynamicsStage(context, node) }] : [];
    });
    let last = from;
    for (const { stage } of stages) {
      last.connect(stage.input);
      last = stage.output;
    }
    last.connect(to);
  };

  return {
    set(effects, keyOf) {
      const next = shapeOf(effects, dynamics);
      if (next !== shape) {
        shape = next;
        build(effects);
      }
      for (const { id, stage } of stages) {
        const effect = effects.find((candidate) => candidate.id === id);
        if (effect) stage.update(effect, keyOf);
      }
    },
    dispose() {
      for (const { stage } of stages) stage.dispose();
      stages = [];
      from.disconnect();
    },
  };
}
