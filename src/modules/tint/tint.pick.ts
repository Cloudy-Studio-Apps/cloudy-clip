import type { MediaApi } from "@/modules/media";
import type { PreviewApi } from "@/modules/preview";
import {
  animatedClip,
  clipEnd,
  clipPlacement,
  clipTransform,
  formatOf,
  gradeOf,
  type ProjectApi,
} from "@/modules/project";
import { pickAt } from "./logic/pick";
import { pixelsOf } from "./tint.pixels";
import { videoRange } from "./tint.range";
import { TINT_CUT } from "./tint.filter";
import type { LutFiles, TintApi, TintCut } from "./tint.types";

/**
 * The pickers' one way to read a color (`TintApi.pickColor`): captures the clip alone and ungraded
 * (`captureAt` with `only` and `bypassFilters`) at the playhead, kept inside the clip, decodes it
 * and reads the point through the corrections above the node (`logic/pick.ts`). The capture has
 * the clip where the viewer shows it, so the clicked point is read as it is; the clip's
 * placement (`clipPlacement` with its keyed transform and, for a file, the probed picture size)
 * tells whether the point is on the picture and where (`at`). Clips whose size isn't known here
 * (a composition placed in another) are read without that test. LUTs that are read apply; one
 * still loading or missing is left out, as the preview does. One per kernel.
 */
export function createPicker(
  project: ProjectApi,
  preview: PreviewApi,
  media: MediaApi,
  luts: LutFiles,
): Pick<TintApi, "pickColor"> {
  return {
    async pickColor(clipId, nodeId, point, level = "clip") {
      const state = project.store.getState();
      const clip = state.clips[clipId];
      const compositionId = clip && state.tracks[clip.trackId]?.compositionId;
      if (!clip || !compositionId) throw new Error("That clip is no longer in the project.");
      const time = Math.min(Math.max(preview.playback.getTime(), clip.start), clipEnd(clip) - 1);
      // The picture coming into the level: the clip alone and ungraded, the clip alone with its
      // own grade, or the whole frame with every grade but the timeline's.
      const into: TintCut = { level, node: null };
      const data = await preview.captureAt(
        time,
        compositionId,
        level === "clip"
          ? { only: clipId, bypassFilters: true }
          : level === "group"
            ? { only: clipId, filters: { [TINT_CUT]: into } }
            : { filters: { [TINT_CUT]: into } },
      );
      const frame = await pixelsOf(data);
      const lutOf = luts.ready(state);
      if (level === "timeline") {
        const grade = state.compositions[compositionId]?.grade ?? null;
        return pickAt(frame, point, grade, nodeId, null, false, lutOf);
      }
      const shown = animatedClip(clip, time);
      const probe = clip.mediaId ? media.probes.getState().probes[clip.mediaId] : undefined;
      const placement =
        probe?.width && probe.height
          ? clipPlacement(
              formatOf(state, clip),
              { width: probe.width, height: probe.height },
              clipTransform(shown),
            )
          : null;
      const group = clip.gradeGroup ? state.gradeGroups?.[clip.gradeGroup]?.grade : undefined;
      return pickAt(
        frame,
        point,
        level === "group" ? (group ?? null) : gradeOf(shown),
        nodeId,
        placement,
        videoRange(clip, state, media),
        lutOf,
      );
    },
  };
}
