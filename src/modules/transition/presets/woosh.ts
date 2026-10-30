// WebKitGTK spike not run; blurs by shrinking and stretching through scratch canvases, without ctx.filter (ruling R1).
import { prop } from "@/modules/element";
import { bump, clamp01, easeInOutQuint } from "../logic/easing";
import { blurCanvas } from "./presets.cache";
import { defineTransitionPreset } from "../transition.points";

/** How much narrower each blur level is than the one before. */
const LEVEL_STEP = 4;
const LEVELS = 3;

/**
 * A whip pan: a and b sit side by side and the pair flies across the frame, slow at both ends and
 * very fast in the middle. The pair is blurred sideways as one picture, so the seam disappears;
 * the blur comes from squeezing the width down and stretching it back, and follows the speed.
 */
export const wooshPreset = defineTransitionPreset({
  id: "woosh",
  name: "Woosh",
  category: "blur",
  properties: { direction: prop.enum(["left", "right"]) },
  defaults: () => ({ direction: "left" }),
  mix(ctx, a, b, progress, props) {
    const { width, height } = ctx.canvas;
    // "left": the pictures move toward the left.
    const sign = props.direction === "right" ? 1 : -1;
    const shift = easeInOutQuint(progress) * width * sign;
    const amount = bump(progress) ** 2;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(a, shift, 0, width, height);
    ctx.drawImage(b, shift - width * sign, 0, width, height);

    let source: CanvasImageSource = ctx.canvas;
    let sourceWidth = width;
    for (let level = 0; level < LEVELS && amount > 0.01; level++) {
      const levelWidth = Math.max(2, Math.round(sourceWidth / LEVEL_STEP));
      const blurred = blurCanvas(ctx.canvas, level, levelWidth, height);
      if (!blurred) break;
      blurred.ctx.imageSmoothingEnabled = true;
      blurred.ctx.drawImage(source, 0, 0, levelWidth, height);
      source = blurred.canvas;
      sourceWidth = levelWidth;
      // The wider levels fade in first; the narrowest takes over at the peak of the speed.
      ctx.globalAlpha = clamp01((amount * LEVELS - level) * 1.5);
      if (ctx.globalAlpha > 0) ctx.drawImage(blurred.canvas, 0, 0, width, height);
    }
    ctx.restore();
  },
});
