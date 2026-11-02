import { z } from "zod";
import { defineCommand } from "@/core";
import { elementRef } from "@/modules/element";
import {
  compositionClips,
  compositionContent,
  frameDuration,
  IDENTITY_TRANSFORM,
  projectRef,
} from "@/modules/project";
import {
  checkFormat,
  checkLength,
  compositionId,
  requireComposition,
  settings,
} from "./composition.guards";
import { scaleKeys, scaleTransform } from "./logic/resize";

/** Changes a composition's name, format, background or length. */
export const setSettings = defineCommand({
  id: "composition.setSettings",
  label: "Composition settings",
  description:
    "Changes a composition's settings: name, format ({ width, height, fps }), background, duration (microseconds) and extendToFit. A duration without extendToFit turns Extend to fit off, so the length you set holds. When the size changes clips keep their positions, unless resize is scale, which keeps each in the same proportion of the frame; a picture that follows the frame (a solid with no size of its own) is left alone, since it already fits. Returns the composition.",
  undoable: true,
  input: z.object({
    compositionId,
    ...settings,
    resize: z
      .enum(["keep", "scale"])
      .optional()
      .describe("When the size changes: keep clips' positions (default), or scale them with it"),
  }),
  run(ctx, { compositionId: id, resize, ...input }) {
    const { store } = ctx.require(projectRef);
    const elements = ctx.require(elementRef);
    const state = store.getState();
    const before = requireComposition(state, id).format;
    if (input.format) checkFormat(input.format);
    if (input.duration !== undefined) checkLength(input.duration, input.format ?? before);
    const clips = input.format && resize === "scale" ? compositionClips(state, id) : [];
    ctx.mutate(store, (draft) => {
      for (const clip of clips) {
        const { id: clipId, kind, transform, animation } = clip;
        const definition = elements.get(kind)?.definition;
        const fit = definition?.picture?.fit;
        if (!fit || !definition.supports?.transform) continue;
        if (definition.picture?.followsFrame?.(clip)) continue;
        draft.clips[clipId]!.transform = scaleTransform(
          transform ?? IDENTITY_TRANSFORM,
          fit,
          before,
          input.format!,
        );
        const keys = scaleKeys(animation, fit, before, input.format!);
        if (keys) draft.clips[clipId]!.animation = keys;
      }
      const composition = draft.compositions[id]!;
      if (input.name !== undefined) composition.name = input.name;
      if (input.format !== undefined) composition.format = input.format;
      if (input.background !== undefined) composition.background = input.background;
      if (input.duration !== undefined) {
        composition.duration = input.duration;
        composition.extendToFit = false;
      }
      if (input.extendToFit !== undefined) composition.extendToFit = input.extendToFit;
    });
    return store.getState().compositions[id];
  },
});

/** Makes a composition the one that opens first and is exported later. */
export const setMain = defineCommand({
  id: "composition.setMain",
  label: "Set as Main",
  description:
    "Makes a composition Main: the one that opens with the project and is exported later.",
  undoable: true,
  input: z.object({ compositionId }),
  run(ctx, { compositionId: id }) {
    const { store } = ctx.require(projectRef);
    requireComposition(store.getState(), id);
    ctx.mutate(store, (draft) => {
      draft.mainCompositionId = id;
    });
  },
});

/** Sets a composition's length to the end of its last clip, once. */
export const extendToFitOnce = defineCommand({
  id: "composition.extendToFit",
  label: "Extend to fit",
  description:
    "Sets a composition's length to the end of its last clip, once. It stays a fixed length afterwards.",
  undoable: true,
  input: z.object({ compositionId }),
  run(ctx, { compositionId: id }) {
    const { store } = ctx.require(projectRef);
    const { format } = requireComposition(store.getState(), id);
    const end = Math.max(compositionContent(store.getState(), id), frameDuration(format));
    ctx.mutate(store, (draft) => {
      draft.compositions[id]!.duration = end;
    });
  },
});
