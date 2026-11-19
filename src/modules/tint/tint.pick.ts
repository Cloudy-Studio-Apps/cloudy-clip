import type { Micros } from "@/core";
import type { MediaApi } from "@/modules/media";
import type { PreviewApi } from "@/modules/preview";
import {
  animatedClip,
  followedClip,
  clipEnd,
  clipPlacement,
  clipTransform,
  formatOf,
  gradeOf,
  type Clip,
  type ClipPlacement,
  type ProjectApi,
  type ProjectState,
} from "@/modules/project";
import { pickAt } from "./logic/pick";
import { pixelsOf } from "./tint.pixels";
import { videoRange } from "./tint.range";
import { TINT_CUT } from "./tint.filter";
import type { LutFiles, TintApi, TintCut } from "./tint.types";

/**
 * The pickers' one way to read a color (`TintApi.pickColor`) and a clip's ungraded frame
 * (`TintApi.clipFrame`): captures the clip alone and ungraded (`captureAt` with `only` and
 * `bypassFilters`), decodes it and reads points through the corrections above a node
 * (`logic/pick.ts`). The capture has the clip where the viewer shows it, so the clicked point is
 * read as it is; the clip's placement (`clipPlacement` with its keyed transform and, for a file,
 * the probed picture size) tells whether the point is on the picture and where (`at`). Clips
 * whose size isn't known here (a composition placed in another) are read without that test. LUTs
 * that are read apply; one still loading or missing is left out, as the preview does. One per kernel.
 */
export function createPicker(
  project: ProjectApi,
  preview: PreviewApi,
  media: MediaApi,
  luts: LutFiles,
): Pick<TintApi, "pickColor" | "clipFrame"> {
  const clipOf = (clipId: string) => {
    const state = project.store.getState();
    const clip = state.clips[clipId];
    const compositionId = clip && state.tracks[clip.trackId]?.compositionId;
    if (!clip || !compositionId) throw new Error("That clip is no longer in the project.");
    return { state, clip, compositionId };
  };
  const placementOf = (state: ProjectState, clip: Clip, time: Micros): ClipPlacement | null => {
    const probe = clip.mediaId ? media.probes.getState().probes[clip.mediaId] : undefined;
    return probe?.width && probe.height
      ? clipPlacement(
          formatOf(state, clip),
          { width: probe.width, height: probe.height },
          clipTransform(followedClip(clip, time, state.paths)),
        )
      : null;
  };
  const clipFrame: TintApi["clipFrame"] = async (clipId, time) => {
    const { compositionId } = clipOf(clipId);
    const data = await preview.captureAt(time, compositionId, {
      only: clipId,
      bypassFilters: true,
    });
    const frame = await pixelsOf(data);
    const { state, clip } = clipOf(clipId);
    return {
      frame,
      placement: placementOf(state, clip, time),
      videoRange: videoRange(clip, state, media),
      lutOf: luts.ready(state),
    };
  };
  return {
    clipFrame,
    async pickColor(clipId, nodeId, point, level = "clip") {
      const { state, clip, compositionId } = clipOf(clipId);
      const time = Math.min(Math.max(preview.playback.getTime(), clip.start), clipEnd(clip) - 1);
      if (level === "clip") {
        const f = await clipFrame(clipId, time);
        const grade = gradeOf(animatedClip(project.store.getState().clips[clipId] ?? clip, time));
        return pickAt(f.frame, point, grade, nodeId, f.placement, f.videoRange, f.lutOf);
      }
      // The picture coming into the level: the clip alone with its own grade, or the whole frame
      // with every grade but the timeline's.
      const into: TintCut = { level, node: null };
      const data = await preview.captureAt(
        time,
        compositionId,
        level === "group"
          ? { only: clipId, filters: { [TINT_CUT]: into } }
          : { filters: { [TINT_CUT]: into } },
      );
      const frame = await pixelsOf(data);
      const lutOf = luts.ready(state);
      if (level === "timeline") {
        const grade = state.compositions[compositionId]?.grade ?? null;
        return pickAt(frame, point, grade, nodeId, null, false, lutOf);
      }
      const group = clip.gradeGroup ? state.gradeGroups?.[clip.gradeGroup]?.grade : undefined;
      return pickAt(
        frame,
        point,
        group ?? null,
        nodeId,
        placementOf(state, clip, time),
        videoRange(clip, state, media),
        lutOf,
      );
    },
  };
}
