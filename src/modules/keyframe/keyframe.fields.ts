import type { StoreApi } from "zustand";
import type { CommandContext, ModuleContext } from "@/core";
import { getPath, keyableFields, labelOf, elementRef, setProps } from "@/modules/element";
import { formatOfTrack, projectRef, type KeyValue } from "@/modules/project";
import { keyTargets } from "./keyframe.points";
import type {
  KeyField,
  KeyframeApi,
  KeyframeClipboard,
  KeyframeViewState,
  KeyTarget,
} from "./keyframe.types";

/** A patch with `value` at a dotted path: `("a.b", 1)` is `{ a: { b: 1 } }`. */
function patchAt(path: string, value: KeyValue): Record<string, unknown> {
  return path.split(".").reduceRight<unknown>((inner, key) => ({ [key]: inner }), value) as Record<
    string,
    unknown
  >;
}

/** The element's own fields: every number, color, enum and boolean its kind declares. */
export function elementTarget(ctx: Pick<ModuleContext, "require">): KeyTarget {
  return {
    id: "element",
    fields(clip, track) {
      const elementApi = ctx.require(elementRef);
      const element = elementApi.get(clip.kind ?? "media");
      if (!element) return [];
      const format = formatOfTrack(ctx.require(projectRef).store.getState(), clip.trackId);
      return keyableFields(element, clip, track).map(({ path, spec, blend, shared }): KeyField => ({
        path,
        label: spec.label ?? labelOf(path),
        blend,
        ...(shared && { shared: true as const }),
        ...(spec.min !== undefined && { min: spec.min }),
        ...(spec.max !== undefined && { max: spec.max }),
        ...(spec.kind === "enum" && spec.values && { values: spec.values }),
        read: (at) => getPath(elementApi.resolve(at, format), path) as KeyValue,
        commitStatic: (run: CommandContext, clipId, value) =>
          run.execute(setProps, { clipIds: [clipId], patch: patchAt(path, value) }),
      }));
    },
  };
}

/** The module's API: the fields of every target, looked up from the clip's track. */
export function createKeyframeApi(
  ctx: ModuleContext,
  view: StoreApi<KeyframeViewState>,
  clipboard: KeyframeClipboard,
): KeyframeApi {
  const targets = () => ctx.points.get(keyTargets);
  const trackOf = (trackId: string) => ctx.require(projectRef).store.getState().tracks[trackId];
  return {
    view,
    clipboard,
    fieldsOf(clip) {
      const track = trackOf(clip.trackId);
      return track ? targets().flatMap((target) => target.fields(clip, track)) : [];
    },
    fieldOf(clip, path) {
      const track = trackOf(clip.trackId);
      if (!track) return undefined;
      for (const target of targets()) {
        const field = target.fields(clip, track).find((f) => f.path === path);
        if (field) return { target, field };
      }
      return undefined;
    },
  };
}
