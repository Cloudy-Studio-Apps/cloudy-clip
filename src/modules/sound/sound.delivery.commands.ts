import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { compositionMixOf, projectRef, type DeliverySettings } from "@/modules/project";
import { soundOnlySpec } from "@/modules/export";
import { addEffect, moveEffect, setEffect } from "./sound.effects.commands";
import { setMaster } from "./sound.mix.commands";
import { isStale, storedFor } from "./sound.analysis.store";
import { targetComposition, writeComposition } from "./sound.mix.write";
import { DEFAULT_STANDARD, deliveryOf, settingsOf } from "./logic/standards";
import { limiterPlan, trimAfter, trimChange } from "./logic/match";
import { soundRef } from "./sound.ref";

const STANDARD_IDS = [
  "youtube",
  "spotify",
  "applePodcasts",
  "tiktok",
  "ebuR128",
  "atscA85",
  "custom",
] as const;

/** Sets the standard and target a composition is delivered against. */
export const setDelivery = defineCommand({
  id: "sound.setDelivery",
  label: "Change delivery standard",
  description:
    "Sets the standard your open composition (or compositionId) is delivered against: standard is youtube, spotify, applePodcasts, tiktok, ebuR128, atscA85 or custom. A standard brings its own loudnessLufs and peakDbtp; with custom, pass them (loudnessLufs -40 to -5, peakDbtp -20 to 0). Passing a figure without a standard, or a figure that differs from the standard's, makes it custom. Shared by mixes A and B. Fails with composition.not_found.",
  undoable: true,
  input: z.object({
    compositionId: z.string().optional(),
    standard: z.enum(STANDARD_IDS).optional(),
    loudnessLufs: z.number().min(-40).max(-5).optional(),
    peakDbtp: z.number().min(-20).max(0).optional(),
  }),
  run(ctx, { compositionId, standard, loudnessLufs, peakDbtp }) {
    const { store } = ctx.require(projectRef);
    const id = targetComposition(ctx, compositionId);
    const mix = compositionMixOf(store.getState().compositions[id]!);
    const current = deliveryOf(mix);
    const base = standard && standard !== "custom" ? settingsOf(standard) : current;
    const next: DeliverySettings = {
      standard: standard ?? current.standard,
      loudnessLufs: loudnessLufs ?? base.loudnessLufs,
      peakDbtp: peakDbtp ?? base.peakDbtp,
    };
    const own = settingsOf(next.standard);
    if (
      next.standard !== "custom" &&
      (next.loudnessLufs !== own.loudnessLufs || next.peakDbtp !== own.peakDbtp)
    ) {
      next.standard = "custom";
    }
    const rest = { ...mix };
    delete rest.delivery;
    const isDefault = JSON.stringify(next) === JSON.stringify(settingsOf(DEFAULT_STANDARD));
    ctx.mutate(store, (draft) =>
      writeComposition(draft.compositions[id]!, { ...rest, ...(!isDefault && { delivery: next }) }),
    );
    return next;
  },
});

/** Measures the whole mix of a composition against its standard, in the background. */
export const analyzeMix = defineCommand({
  id: "sound.analyzeMix",
  label: "Analyze whole mix",
  description:
    "Starts measuring the whole mix of your open composition (or compositionId) without playing it: integrated loudness, loudness range, true peak, and the stretches over the delivery standard's peak limit or clipped. It runs in the background and returns at once ({ started: true }); the result is kept until the document changes (then it is stale). If one already runs, returns { started: false, running: true }. Fails with export.noSound, export.missingMedia, export.mediaNotReady, export.denoise_pending, composition.not_found.",
  undoable: false,
  input: z.object({ compositionId: z.string().optional() }),
  async run(ctx, { compositionId }) {
    const { analyzer } = ctx.require(soundRef);
    const { store } = ctx.require(projectRef);
    const id = targetComposition(ctx, compositionId);
    if (analyzer.state.getState().running[id]) {
      return { started: false, running: true, compositionId: id };
    }
    const measured = store.getState();
    const { peakDbtp } = deliveryOf(compositionMixOf(measured.compositions[id]!));
    await analyzer.start(id, soundOnlySpec(ctx, id), peakDbtp, measured);
    return { started: true, compositionId: id };
  },
});

/** Stops the analysis of a composition, and a Match target running for it. */
export const cancelAnalysis = defineCommand({
  id: "sound.cancelAnalysis",
  label: "Cancel analysis",
  description:
    "Stops the analysis of the open composition's mix (or compositionId), and a match target running for it (which then changes nothing), if one runs.",
  undoable: false,
  input: z.object({ compositionId: z.string().optional() }),
  async run(ctx, { compositionId }) {
    await ctx.require(soundRef).matcher.cancel(targetComposition(ctx, compositionId));
  },
});

/** Brings a composition's mix to its delivery target, in the background. */
export const startMatch = defineCommand({
  id: "sound.startMatch",
  label: "Match target",
  description:
    "Brings the whole mix of your open composition (or compositionId) to its delivery target, in the background, and returns at once ({ started: true }). It uses the last analysis when fresh (or measures the mix), works out Master's change and a Limiter at the peak limit, measures the mix again with them on the side (the project isn't touched yet), corrects once by what is still missing (at most 3 dB, so the limiter isn't left doing all the work), then makes the one change (sound.matchTarget, one undo step) and analyzes where the mix landed. If one already runs, returns { started: false, running: true }. If the project changes meanwhile, it stops and changes nothing. Fails at once only when the mix can't be built: composition.not_found, export.noComposition, export.noSound, export.missingMedia, export.mediaNotReady, export.denoise_pending. What fails later (a silent mix, a failed analysis, a change to the project, a cancel) ends it without a change: the reason is in the analyses' matchFailed (and a toast), and sound_match_target returns it as sound.match_failed.",
  undoable: false,
  input: z.object({ compositionId: z.string().optional() }),
  run(ctx, { compositionId }) {
    const { analyzer, matcher } = ctx.require(soundRef);
    const id = targetComposition(ctx, compositionId);
    if (analyzer.state.getState().matching[id]) {
      return { started: false, running: true, compositionId: id };
    }
    matcher.start(id, soundOnlySpec(ctx, id), { origin: ctx.origin, actor: ctx.actor });
    return { started: true, compositionId: id };
  },
});

/** Moves Master's trim by the measured difference to the target, and guards the peak with a limiter. */
export const matchTarget = defineCommand({
  id: "sound.matchTarget",
  label: "Match target",
  description:
    "Raises or lowers Master's input trim (before the fader, its volume line, pan and effects; the fader and the line are not touched) by the difference between the delivery target and the last analysis, plus correctionDb (the trim stays within -24 to 24 dB), and guards the peak limit with a Limiter at the end of Master's chain, in one undo step: one that works is left as it is; one that is off is switched on at the peak limit (or ceilingDb, under it), and moved to the end when it isn't last; otherwise one is added there. Needs a fresh analysis: fails with sound.no_analysis, sound.analysis_stale (the document changed since) or sound.silent_mix. Returns { trimDb, changeDb, limiterAdded, clamped } (clamped: the trim's range kept the mix from the target). sound.startMatch (Match target) runs it with the correction its second measurement found.",
  undoable: true,
  input: z.object({
    compositionId: z.string().optional(),
    correctionDb: z
      .number()
      .min(-12)
      .max(12)
      .default(0)
      .describe(
        "Added on top of the gap, dB: what a measurement with the change still found missing",
      ),
    ceilingDb: z
      .number()
      .min(-20)
      .max(0)
      .optional()
      .describe("The limiter's ceiling, dB, at or under the peak limit; missing: the peak limit"),
  }),
  async run(ctx, { compositionId, correctionDb, ceilingDb: ceilingIn }) {
    const { store } = ctx.require(projectRef);
    const { analyzer } = ctx.require(soundRef);
    const id = targetComposition(ctx, compositionId);
    const stored = storedFor(analyzer.state, id);
    if (!stored) {
      throw new CommandFailure("sound.no_analysis", "Analyze the whole mix first.");
    }
    if (isStale(stored, store.getState())) {
      throw new CommandFailure(
        "sound.analysis_stale",
        "The project changed since the mix was analyzed: analyze it again.",
      );
    }
    const { integrated } = stored.result;
    if (integrated === null) {
      throw new CommandFailure("sound.silent_mix", "The mix is silent: there is nothing to match.");
    }
    const mix = compositionMixOf(store.getState().compositions[id]!);
    const delivery = deliveryOf(mix);
    const before = mix.master.trimDb ?? 0;
    const gap = delivery.loudnessLufs - integrated;
    const trimDb = trimAfter(before, trimChange(before, gap) + correctionDb);
    await ctx.execute(setMaster, { compositionId: id, trimDb });
    const plan = limiterPlan(mix.master, delivery.peakDbtp);
    if (plan.own) {
      const ceilingDb = Math.min(plan.ceilingDb, ceilingIn ?? plan.ceilingDb);
      const effectId =
        plan.switchOn ??
        (await ctx.execute(addEffect, { target: "master", compositionId: id, kind: "limiter" }))
          .effectId;
      await ctx.execute(setEffect, {
        target: "master",
        compositionId: id,
        effectId,
        patch: { on: true, ceilingDb },
      });
      if (plan.toEnd) {
        const to = (mix.master.effects?.length ?? 1) - 1;
        await ctx.execute(moveEffect, { target: "master", compositionId: id, effectId, to });
      }
    }
    return {
      trimDb,
      changeDb: Math.round((trimDb - before) * 100) / 100,
      limiterAdded: plan.own && plan.switchOn === null,
      clamped: Math.abs(trimDb - (before + gap + correctionDb)) > 0.005,
    };
  },
});

/** Every delivery command, for the module. */
export const soundDeliveryCommands = [
  setDelivery,
  analyzeMix,
  cancelAnalysis,
  startMatch,
  matchTarget,
];
