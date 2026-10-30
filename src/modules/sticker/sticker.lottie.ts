import type { AnimationConfigWithData } from "lottie-web";
import type { LottiePlayer } from "./sticker.types";

/** The picture is rendered this many times larger than the animation's own size. */
const QUALITY = 2;

/**
 * Loads a Lottie file for drawing frame by frame. It never plays: every draw seeks to an exact
 * time, so it has no clock of its own and works while paused, scrubbing or with the window hidden.
 * One player can serve any number of clips, because each draw seeks it first.
 */
export async function createLottiePlayer(url: string): Promise<LottiePlayer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const data = (await response.json()) as { w: number; h: number };
  // Loaded here, not at the top of the file: it needs a document.
  const { default: lottie } = await import("lottie-web/build/player/lottie_light_canvas");

  const canvas = document.createElement("canvas");
  canvas.width = data.w * QUALITY;
  canvas.height = data.h * QUALITY;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is not available");

  // Its types ask for a `container`, but the canvas renderer draws to `context` without one.
  const config = {
    renderer: "canvas",
    autoplay: false,
    loop: false,
    animationData: data,
    rendererSettings: { context, clearCanvas: true },
  } as unknown as AnimationConfigWithData<"canvas">;
  const animation = lottie.loadAnimation(config);
  await new Promise<void>((resolve, reject) => {
    animation.addEventListener("DOMLoaded", () => resolve());
    animation.addEventListener("data_failed", () => reject(new Error(`Bad Lottie file: ${url}`)));
  });

  return {
    drawAt(ctx, seconds, box) {
      const frame = (seconds * animation.frameRate) % animation.totalFrames;
      animation.goToAndStop(frame, true);
      ctx.drawImage(canvas, -box.width / 2, -box.height / 2, box.width, box.height);
    },
    dispose: () => animation.destroy(),
  };
}
