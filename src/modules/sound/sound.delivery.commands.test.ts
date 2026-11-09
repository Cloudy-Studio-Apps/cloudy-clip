import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, defineModule, type Kernel } from "@/core";
import { createProjectModule, projectRef, seedProject, compositionMixOf } from "@/modules/project";
import { createAnalyzer } from "./sound.analysis";
import { createAnalysisStore } from "./sound.analysis.store";
import { addEffect, moveEffect, setEffect } from "./sound.effects.commands";
import type { SoundApi } from "./sound.types";
import { soundRef } from "./sound.ref";
import { matchTarget, setDelivery } from "./sound.delivery.commands";
import { setMaster } from "./sound.mix.commands";
import { isStale } from "./sound.analysis.store";
import type { MixAnalysis } from "./sound.delivery.types";

let kernel: Kernel;
const project = () => kernel.modules.require(projectRef);
const analyzer = () => kernel.modules.require(soundRef).analyzer;
const master = () => compositionMixOf(project().store.getState().compositions.c1!).master;
const run = <I>(command: Parameters<Kernel["bus"]["run"]>[0], input: I) =>
  kernel.bus.run(command, input as never);

/** An analysis as if the mix had just been measured. */
function measured(integrated: number | null): void {
  const result: MixAnalysis = { integrated, range: 5, truePeak: -3, problems: [] };
  analyzer().state.setState({
    results: {
      c1: { result, measured: project().store.getState(), peakDbtp: -1, at: 0 },
    },
  });
}

// The sound module needs the whole app to set up; these commands need its analyzer and each other.
const delivery = defineModule({
  ref: soundRef,
  name: "Sound",
  commands: [setDelivery, matchTarget, setMaster, addEffect, setEffect, moveEffect],
  setup({ require, log }) {
    const analyzer = createAnalyzer(createAnalysisStore(), require(projectRef).store.getState, log);
    return { api: { analyzer } as SoundApi };
  },
});

beforeEach(async () => {
  kernel = await createKernel();
  await kernel.modules.loadAll([createProjectModule(seedProject()), delivery]);
});

describe("an analysis after an edit", () => {
  it("is stale once the document changes", async () => {
    measured(-18);
    const stored = () => analyzer().state.getState().results.c1!;
    expect(isStale(stored(), project().store.getState())).toBe(false);
    await run(setMaster, { volumeDb: -3 });
    expect(isStale(stored(), project().store.getState())).toBe(true);
    expect(await run(matchTarget, {})).toMatchObject({
      ok: false,
      error: { code: "sound.analysis_stale" },
    });
  });
});

describe("match target", () => {
  it("raises Master's trim by the gap and adds a limiter at the peak limit, in one undo step", async () => {
    await run(setDelivery, { standard: "youtube" });
    measured(-32);
    const result = await run(matchTarget, {});
    expect(result).toMatchObject({
      ok: true,
      value: { trimDb: 18, limiterAdded: true, clamped: false },
    });
    expect(master()).toMatchObject({ volumeDb: 0, trimDb: 18 });
    expect(master().effects).toMatchObject([{ kind: "limiter", ceilingDb: -1 }]);
    kernel.history.undo();
    expect(master().trimDb).toBeUndefined();
    expect(master().effects).toBeUndefined();
  });

  it("adds the second step's correction and lower ceiling in the same one undo step", async () => {
    measured(-18);
    const result = await run(matchTarget, { correctionDb: 1.5, ceilingDb: -1.3 });
    expect(result).toMatchObject({ ok: true, value: { trimDb: 5.5, clamped: false } });
    expect(master().effects).toMatchObject([{ kind: "limiter", ceilingDb: -1.3 }]);
    kernel.history.undo();
    expect(master().trimDb).toBeUndefined();
    expect(master().effects).toBeUndefined();
  });

  it("switches on a limiter that is off, at the end of the chain, instead of adding a second", async () => {
    const added = await run(addEffect, { target: "master", kind: "limiter" });
    const effectId = (added as { value: { effectId: string } }).value.effectId;
    await run(setEffect, { target: "master", effectId, patch: { on: false, ceilingDb: -6 } });
    await run(addEffect, { target: "master", kind: "eq" });
    measured(-18);
    const result = await run(matchTarget, {});
    expect(result).toMatchObject({ ok: true, value: { limiterAdded: false } });
    expect(master().effects).toMatchObject([
      { kind: "eq" },
      { kind: "limiter", on: true, ceilingDb: -1 },
    ]);
  });

  it("refuses without a result and for a silent mix", async () => {
    expect(await run(matchTarget, {})).toMatchObject({
      ok: false,
      error: { code: "sound.no_analysis" },
    });
    measured(null);
    expect(await run(matchTarget, {})).toMatchObject({
      ok: false,
      error: { code: "sound.silent_mix" },
    });
  });
});
