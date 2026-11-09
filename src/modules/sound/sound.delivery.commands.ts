import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { compositionMixOf, projectRef, type DeliverySettings } from "@/modules/project";
import { soundOnlySpec } from "@/modules/export";
import { addEffect, setEffect } from "./sound.effects.commands";
import { setMaster } from "./sound.mix.commands";
import { isStale, storedFor } from "./sound.analysis.store";
import { targetComposition, writeComposition } from "./sound.mix.write";
import { DEFAULT_STANDARD, deliveryOf, settingsOf } from "./logic/standards";
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
    const { peakDbtp } = deliveryOf(compositionMixOf(store.getState().compositions[id]!));
    await analyzer.start(id, soundOnlySpec(ctx, id), peakDbtp);
    return { started: true, compositionId: id };
  },
});

/** Stops the analysis of a composition. */
export const cancelAnalysis = defineCommand({
  id: "sound.cancelAnalysis",
  label: "Cancel analysis",
  description: "Stops the analysis of the open composition's mix (or compositionId), if one runs.",
  undoable: false,
  input: z.object({ compositionId: z.string().optional() }),
  async run(ctx, { compositionId }) {
    await ctx.require(soundRef).analyzer.cancel(targetComposition(ctx, compositionId));
  },
});

/** Moves Master's volume by the measured difference to the target, and guards the peak with a limiter. */
export const matchTarget = defineCommand({
  id: "sound.matchTarget",
  label: "Match target",
  description:
    "Raises or lowers Master's volume (the fader, on top of any master volume line, which is not touched) by the difference between the delivery target and the last analysis (-60 to 12 dB), and adds a Limiter to Master at the peak limit if the master has none, in one undo step. Needs a fresh sound_analyze_mix result: fails with sound.no_analysis, sound.analysis_stale (the document changed since) or sound.silent_mix. Returns { volumeDb, changeDb, limiterAdded, clamped } (clamped: the fader's range kept the mix from the target). A limiter already on Master that is switched off is switched on and set to the peak limit instead of adding a second. A limiter lowers loudness a little: analyze again to see where the mix landed.",
  undoable: true,
  input: z.object({ compositionId: z.string().optional() }),
  async run(ctx, { compositionId }) {
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
    const before = mix.master.volumeDb;
    const wanted = before + delivery.loudnessLufs - integrated;
    const volumeDb = Math.min(12, Math.max(-60, Math.round(wanted * 100) / 100));
    await ctx.execute(setMaster, { compositionId: id, volumeDb });
    const ceilingDb = Math.min(0, Math.max(-20, delivery.peakDbtp));
    const limiter = mix.master.effects?.find((e) => e.kind === "limiter");
    const limiterAdded = !limiter;
    if (!limiter) {
      const { effectId } = await ctx.execute(addEffect, {
        target: "master",
        compositionId: id,
        kind: "limiter",
      });
      await ctx.execute(setEffect, {
        target: "master",
        compositionId: id,
        effectId,
        patch: { ceilingDb },
      });
    } else if (!limiter.on) {
      await ctx.execute(setEffect, {
        target: "master",
        compositionId: id,
        effectId: limiter.id,
        patch: { on: true, ceilingDb },
      });
    }
    return {
      volumeDb,
      changeDb: Math.round((volumeDb - before) * 100) / 100,
      limiterAdded,
      clamped: Math.abs(volumeDb - wanted) > 0.005,
    };
  },
});

/** Every delivery command, for the module. */
export const soundDeliveryCommands = [setDelivery, analyzeMix, cancelAnalysis, matchTarget];
