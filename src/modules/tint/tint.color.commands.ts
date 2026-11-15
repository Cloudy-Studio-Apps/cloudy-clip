import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { INPUT_SPACES, projectRef, type ClipGrade } from "@/modules/project";
import { addGrade } from "./logic/look";
import { checkedGrade, readGrade, writeGrade } from "./tint.guards";
import { tintRef } from "./tint.ref";
import { readLut } from "./tint.service";
import type { LoadedLut, LookDef } from "./tint.types";

/** Reads and parses a `.cube` file, every failure a `CommandFailure` naming the file. */
async function readLutOrFail(path: string): Promise<LoadedLut> {
  try {
    return await readLut(path);
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    if (code === "not_found") {
      throw new CommandFailure("tint.lut_not_found", `No file at ${path}`);
    }
    throw new CommandFailure("tint.bad_lut", `${path} can't be used as a LUT: ${message ?? error}`);
  }
}

/** A file's name without its folder or extension. */
const nameOf = (path: string) => (path.split(/[\\/]/).pop() ?? path).replace(/\.[^.]*$/, "");

/**
 * Adds a `.cube` LUT file to the project by path, kept by path like media (`ProjectState.luts`).
 * The file is read and parsed first; one undo step. Returns `{ lutId }`; a correction uses it
 * through `tint.setCorrection`'s `patch.lut`. A path already imported gives that LUT's id and
 * changes nothing.
 */
export const importLut = defineCommand({
  id: "tint.importLut",
  label: "Import LUT",
  description:
    "Adds a .cube LUT file to the project, by absolute path: a 3D LUT (LUT_3D_SIZE 2 to 65) or a 1D one (LUT_1D_SIZE 2 to 4096), with DOMAIN_MIN / DOMAIN_MAX honoured, at most 8 MB. The file is kept by path like media (relink it with tint_relink_lut if it moves); it is not copied. Returns { lutId }; a path already imported returns that LUT's id and adds nothing. Apply it to a correction with tint_set_correction patch.lut { id: lutId, strength 0 to 1 }; it runs after Creative, mixed toward by strength. Fails with tint.lut_not_found (no file there) or tint.bad_lut (not an absolute .cube path, too large, or not a valid .cube; the message says why).",
  undoable: true,
  input: z.object({ path: z.string().min(1) }),
  async run(ctx, { path }) {
    const known = Object.values(ctx.require(projectRef).store.getState().luts ?? {});
    const same = known.find((lut) => lut.path === path);
    if (same) return { lutId: same.id };
    const lut = await readLutOrFail(path);
    const lutId = createId("lut");
    ctx.require(tintRef).luts.put(path, lut);
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      (draft.luts ??= {})[lutId] = { id: lutId, name: nameOf(path), path, size: lut.table.size };
    });
    return { lutId };
  },
});

/** Points an imported LUT at another file: for one that moved. Its corrections keep it. */
export const relinkLut = defineCommand({
  id: "tint.relinkLut",
  label: "Locate LUT",
  description:
    "Points an imported LUT (from tint_describe's luts) at the .cube file at an absolute path, keeping the corrections that use it: for a LUT whose file is missing. The file is read and parsed first; one undo step. Fails with tint.lut_not_found (no such LUT, or no file there) or tint.bad_lut (the file can't be used; the message says why).",
  undoable: true,
  input: z.object({ lutId: z.string().min(1), path: z.string().min(1) }),
  async run(ctx, { lutId, path }) {
    const { store } = ctx.require(projectRef);
    if (!store.getState().luts?.[lutId]) {
      throw new CommandFailure("tint.lut_not_found", `No LUT with id "${lutId}"`);
    }
    const lut = await readLutOrFail(path);
    ctx.require(tintRef).luts.put(path, lut);
    ctx.mutate(store, (draft) => {
      const target = draft.luts?.[lutId];
      if (target) Object.assign(target, { path, size: lut.table.size });
    });
  },
});

/**
 * Sets the camera color space of clips: their source is turned into Rec.709 from it before the
 * grade. Every clip is checked before anything is written; one undo step for all.
 */
export const setInput = defineCommand({
  id: "tint.setInput",
  label: "Camera color space",
  description:
    "Sets the camera color space of clips (input): rec709 (the default, no conversion), srgb, slog3 (Sony S-Log3 / S-Gamut3.Cine), appleLog, clog2 (Canon C-Log2 / Cinema Gamut), clog3 (Canon C-Log3 / Cinema Gamut), vlog (Panasonic V-Log / V-Gamut) or flog (Fujifilm F-Log / F-Gamut). The clip's picture is converted from it to Rec.709 before its first correction, from the makers' published formulas; light past white is kept for the grade (exposure or rolloff bring it back; the output clips at the end), colors outside Rec.709 are clipped at black. A video file is read as video range unless ffprobe found it full range; an image is full range. srgb matches display light (sRGB decoded, then encoded for the gamma 2.4 output). Grading happens in Rec.709, output is Rec.709 gamma 2.4. Sources are decoded at 8 bits, so log footage can band. A composition clip is already Rec.709 and takes only rec709 (tint.input_not_for_composition). All clips change in one undo step, or none: fails with tint.target_not_found, tint.not_gradeable or tint.input_not_for_composition.",
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string().min(1)).min(1),
    input: z.enum(INPUT_SPACES),
  }),
  run(ctx, { clipIds, input }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const writes: [string, ClipGrade | undefined][] = [];
    for (const clipId of clipIds) {
      const grade = readGrade(state, { clipId });
      if (input !== "rec709" && state.clips[clipId]?.compositionRef !== undefined) {
        throw new CommandFailure(
          "tint.input_not_for_composition",
          `Clip "${clipId}" is a composition, whose picture is Rec.709 already: only rec709 applies.`,
        );
      }
      if ((grade?.input ?? "rec709") === input) continue;
      writes.push([clipId, checkedGrade({ nodes: {}, out: { node: "source" }, ...grade, input })]);
    }
    if (writes.length === 0) return;
    ctx.mutate(store, (draft) => {
      for (const [clipId, grade] of writes) writeGrade(draft, { clipId }, grade);
    });
  },
});

/**
 * Adds a look's corrections, or a still's grade, at the bottom of clips' grades: after everything
 * they have, so it runs last. Every clip is checked before anything is written; one undo step for
 * all.
 */
export const applyLook = defineCommand({
  id: "tint.applyLook",
  label: "Apply look",
  description:
    "Adds a look (lookId, from tint_describe's looks) or a still's grade (stillId, from tint_describe's stills) to the grade of clips, after everything they already have, so it runs last. A look adds its corrections one after another, each named after the look; a still adds its stored grade as it is. Give exactly one of lookId and stillId. Nothing is replaced and no clip's camera color space changes; a still with no grade changes nothing. All clips change in one undo step, or none: fails with tint.look_choice (not exactly one id), tint.look_not_found, tint.still_not_found, tint.target_not_found, tint.not_gradeable or tint.invalid_grade.",
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string().min(1)).min(1),
    lookId: z.string().min(1).optional(),
    stillId: z.string().min(1).optional(),
  }),
  run(ctx, { clipIds, lookId, stillId }) {
    if ((lookId === undefined) === (stillId === undefined)) {
      throw new CommandFailure("tint.look_choice", "Give exactly one of lookId and stillId.");
    }
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    let extra: LookDef | ClipGrade | undefined;
    if (lookId !== undefined) {
      extra = ctx.require(tintRef).looks.find(lookId);
      if (!extra) throw new CommandFailure("tint.look_not_found", `No look "${lookId}"`);
    } else {
      const still = state.stills?.[stillId!];
      if (!still) throw new CommandFailure("tint.still_not_found", `No still "${stillId}"`);
      extra = still.grade;
    }
    if (!extra) return;
    const writes: [string, ClipGrade | undefined][] = [];
    for (const clipId of new Set(clipIds)) {
      const next = addGrade(readGrade(state, { clipId }), extra, () => createId("node"));
      if (!next) {
        throw new CommandFailure(
          "tint.invalid_grade",
          `That can't be added to the grade of clip "${clipId}".`,
        );
      }
      writes.push([clipId, checkedGrade(next)]);
    }
    if (writes.length === 0) return;
    ctx.mutate(store, (draft) => {
      for (const [clipId, grade] of writes) writeGrade(draft, { clipId }, grade);
    });
  },
});
