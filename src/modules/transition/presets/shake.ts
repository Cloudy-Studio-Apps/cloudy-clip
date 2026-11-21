// WebKitGTK spike not run; the cut picture jolted in a scratch canvas, blurred along the jolt by a GPU pass (ruling R1).
import { bump, clamp01 } from "../logic/easing";
import { directionalBlurPass } from "../logic/gpu";
import { defineTransitionPreset } from "../transition.points";
import { drawOnly } from "./presets.mask";
import { drawBlurred, drawStacked } from "./presets.blur";
import { drawMoved } from "./presets.camera";
import { intensityProp } from "./presets.props";

/** Jolts over a transition; the jitter is one fixed offset per step. */
const STEPS = 12;
/** Offset at full intensity and the cut, in frame widths. */
const MAX_SHIFT = 0.04;

/**
 * The offset, up to `amp` pixels each way, of the current step. `random` is drawn the same number
 * of times every frame, because it restarts each frame.
 */
function jolt(random: () => number, progress: number, amp: number): [number, number] {
  const step = Math.min(STEPS - 1, Math.floor(progress * STEPS));
  let at: [number, number] = [0, 0];
  for (let i = 0; i < STEPS; i++) {
    const x = random() * 2 - 1;
    const y = random() * 2 - 1;
    if (i === step) at = [x * amp, y * amp];
  }
  return at;
}

/**
 * A jolts around in random jumps, then b does, calming toward the end. Intensity is the size of
 * the jumps and a blur along the last one, strongest at the cut; the blur needs the GPU, so
 * without one the jolt is drawn unblurred.
 */
export const shakePreset = defineTransitionPreset({
  id: "shake",
  name: "Shake",
  category: "camera",
  properties: { intensity: intensityProp() },
  defaults: () => ({ intensity: 0.5 }),
  mix(ctx, a, b, progress, props, env) {
    if (progress <= 0) return drawOnly(ctx, a);
    if (progress >= 1) return drawOnly(ctx, b);
    const { width, height } = ctx.canvas;
    const amp = clamp01(Number(props.intensity ?? 0.5)) * bump(progress) * MAX_SHIFT * width;
    const [dx, dy] = jolt(env.random, progress, amp);
    const length = Math.hypot(dx, dy) / height;
    drawBlurred(ctx, env, length > 1e-4, directionalBlurPass(-1, [dx, dy], length), (target) =>
      drawMoved(target, progress < 0.5 ? a : b, 1, 0, dx, dy),
    );
  },
  thumbnail(ctx, a, b, progress, props, env) {
    const amp =
      clamp01(Number(props.intensity ?? 0.5)) * bump(progress) * MAX_SHIFT * ctx.canvas.width;
    const [dx, dy] = jolt(env.random, progress, amp);
    drawStacked(ctx, (i) =>
      drawMoved(ctx, progress < 0.5 ? a : b, 1, 0, dx * i * 0.5, dy * i * 0.5),
    );
  },
});
