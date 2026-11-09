// TEMPORARY (Task 1 check): removed before the commit.
import type { GpuPass } from "./gpu.types";

export const IDENTITY: GpuPass = {
  key: "check.identity",
  inputs: [-1],
  fragment: "void main() { o = texture(u_in0, v_uv); }",
};

export function exposure(index: number, gain: number): GpuPass {
  return {
    key: "check.exposure",
    inputs: [index - 1],
    uniforms: { u_gain: gain },
    fragment:
      "uniform float u_gain;\nvoid main() { vec4 c = texture(u_in0, v_uv); o = vec4(c.rgb * u_gain, c.a); }",
  };
}

export function canvas2d(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2D canvas is not available");
  return { canvas, ctx };
}

/** RGB of the `size` × `size` pixels at x, y of `source` drawn at width × height. */
export function region(
  source: CanvasImageSource,
  width: number,
  height: number,
  x: number,
  y: number,
  size = 4,
): number[] {
  const { ctx } = canvas2d(width, height);
  ctx.drawImage(source, 0, 0, width, height);
  const data = ctx.getImageData(x, y, size, size).data;
  const out: number[] = [];
  for (let i = 0; i < data.length; i += 4) out.push(data[i]!, data[i + 1]!, data[i + 2]!);
  return out;
}

export function maxDiff(a: readonly number[], b: readonly number[]): number {
  return a.reduce((max, value, i) => Math.max(max, Math.abs(value - (b[i] ?? 0))), 0);
}

export function mean(values: readonly number[]): number {
  return Math.round((values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length)) * 10) / 10;
}

export async function loadVideo(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.volume = 0;
  video.playsInline = true;
  video.loop = true;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The clip did not load")), 10_000);
    video.addEventListener("error", () => reject(new Error("The clip did not load")));
    video.addEventListener("loadeddata", () => {
      clearTimeout(timer);
      resolve();
    });
    video.src = url;
  });
  return video;
}

/** Seeks and waits for the frame (rule 22), with the timeout fallback. */
export async function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  video.currentTime = seconds;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 300);
    video.requestVideoFrameCallback?.(() => resolve());
  });
  const deadline = performance.now() + 10_000;
  while (video.seeking || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    if (performance.now() > deadline) throw new Error("The clip did not decode");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export function release(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute("src");
  video.load();
}
