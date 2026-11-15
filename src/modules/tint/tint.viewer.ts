import type { StoreApi } from "zustand";
import type { PreviewPictureApi } from "@/modules/preview";
import { clipWarningPass, falseColorPass } from "./render/viewer.glsl";
import type { TintView } from "./tint.types";

/** Owner ids of the viewer passes (`PreviewPictureApi.setViewerPasses`). */
export const FALSE_COLOR_PASS = "tint.falseColor";
export const WARNING_PASS = "tint.warning";

/**
 * Keeps the preview's viewer passes as `view.falseColor` and `view.warning` say, live only. Both
 * on: false color alone (its last band already marks what the warning would, and the warning's
 * luma would read false colors). Returns the stop, which also takes both passes away.
 */
export function followViewerPasses(
  view: StoreApi<TintView>,
  picture: PreviewPictureApi,
): () => void {
  const apply = ({ falseColor, warning }: TintView) => {
    picture.setViewerPasses(FALSE_COLOR_PASS, falseColor ? [falseColorPass()] : null);
    picture.setViewerPasses(WARNING_PASS, warning && !falseColor ? [clipWarningPass()] : null);
  };
  apply(view.getState());
  const off = view.subscribe((state, before) => {
    if (state.falseColor !== before.falseColor || state.warning !== before.warning) apply(state);
  });
  return () => {
    off();
    picture.setViewerPasses(FALSE_COLOR_PASS, null);
    picture.setViewerPasses(WARNING_PASS, null);
  };
}
