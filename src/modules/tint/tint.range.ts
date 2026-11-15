import type { MediaApi } from "@/modules/media";
import type { Clip, ProjectState } from "@/modules/project";

/**
 * Whether a clip's picture comes from a video-range file, so a camera curve reads it back as code
 * values (`codeValue`). True for a video file unless ffprobe found it full range (`fullRange`, also
 * before it has been probed: cameras record video range); false for images and compositions.
 */
export function videoRange(
  clip: Clip,
  project: ProjectState,
  media: Pick<MediaApi, "getProbe">,
): boolean {
  const id = clip.mediaId;
  if (id === undefined || project.media[id]?.kind !== "video") return false;
  return media.getProbe(id)?.proxy?.meta?.fullRange !== true;
}
