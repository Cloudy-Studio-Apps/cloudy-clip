import type { PictureSize, ProjectFormat } from "@/modules/project";

/** A sticker's longer side, as a share of the frame's short side. */
export const STICKER_SHARE = 0.3;

/** A sticker's natural size in output pixels, the same look in any format. */
export function stickerSize(format: ProjectFormat, aspect: number): PictureSize {
  const side = STICKER_SHARE * Math.min(format.width, format.height);
  return aspect >= 1
    ? { width: side, height: side / aspect }
    : { width: side * aspect, height: side };
}
