// TEMPORARY (Task 1 check): removed before the commit.
import { createGpuRunner } from "./gpu.runner";
import { canvas2d, exposure, IDENTITY, loadVideo, release, seekTo } from "./gpu.check.read";
import type { GpuPass } from "./gpu.types";

const WARMUP = 3;
const FRAMES = 20;

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number) => Math.round(sorted[Math.floor(q * (sorted.length - 1))]! * 10) / 10;
  return { median: at(0.5), p90: at(0.9) };
}

function passes(count: number): GpuPass[] {
  return [IDENTITY, ...Array.from({ length: count - 1 }, (_, i) => exposure(i + 1, 1.001))];
}

/** ms per frame: upload, `count` passes, draw onto a 2D canvas, a 1-pixel read to wait for it. */
function measure(source: TexImageSource & CanvasImageSource, width: number, height: number) {
  const runner = createGpuRunner();
  const target = canvas2d(width, height);
  const tiny = canvas2d(1, 1);
  const size = { width, height };
  try {
    const time = (work: () => void) => {
      const samples: number[] = [];
      for (let n = 0; n < WARMUP + FRAMES; n++) {
        const t0 = performance.now();
        work();
        target.ctx.getImageData(0, 0, 1, 1);
        tiny.ctx.getImageData(0, 0, 1, 1);
        if (n >= WARMUP) samples.push(performance.now() - t0);
      }
      return stats(samples);
    };
    const result: Record<string, ReturnType<typeof stats>> = {
      baseline2d: time(() => target.ctx.drawImage(source, 0, 0, width, height)),
    };
    for (const count of [1, 5, 12]) {
      const list = passes(count);
      result[`passes${count}`] = time(() =>
        target.ctx.drawImage(runner.run(source, size, list), 0, 0),
      );
    }
    const one = { width: 1, height: 1 };
    result.uploadOnly = time(() => tiny.ctx.drawImage(runner.run(source, one, [IDENTITY]), 0, 0));
    const list = passes(12);
    result.passes12DrawnTo1px = time(() =>
      tiny.ctx.drawImage(runner.run(source, size, list), 0, 0, 1, 1),
    );
    return { floatTargets: runner.floatTargets, ...result };
  } finally {
    runner.dispose();
  }
}

/** 1080p and 4K from a canvas, and from a `<video>` at its own size when given. */
export async function checkTiming(videoUrl: string | null) {
  const out: Record<string, unknown> = {};
  for (const [name, width, height] of [
    ["1920x1080", 1920, 1080],
    ["3840x2160", 3840, 2160],
  ] as const) {
    const { canvas, ctx } = canvas2d(width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#203040");
    gradient.addColorStop(1, "#f0c080");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    out[`canvas ${name}`] = measure(canvas, width, height);
  }
  if (videoUrl) {
    const video = await loadVideo(videoUrl);
    try {
      await seekTo(video, 0.5);
      const { videoWidth: w, videoHeight: h } = video;
      out[`video ${w}x${h}`] = measure(video, w, h);
    } finally {
      release(video);
    }
  }
  return out;
}
