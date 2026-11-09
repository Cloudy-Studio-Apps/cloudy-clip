// TEMPORARY (Task 1 check): removed before the commit.
import { createGpuRunner } from "./gpu.runner";
import type { GpuRunner } from "./gpu.types";
import { IDENTITY, loadVideo, maxDiff, mean, region, release, seekTo } from "./gpu.check.read";

/**
 * One frame of `video`: a 4×4 region drawn by the 2D canvas, through the runner, and by the 2D
 * canvas again (a playing video may move on between draws).
 */
export function compareFrame(runner: GpuRunner, video: HTMLVideoElement, x: number, y: number) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  const before = region(video, width, height, x, y);
  const gpu = region(runner.run(video, { width, height }, [IDENTITY]), width, height, x, y);
  const after = region(video, width, height, x, y);
  return {
    at: Math.round(video.currentTime * 1000) / 1000,
    canvasMean: mean(before),
    gpuMean: mean(gpu),
    diffBefore: maxDiff(before, gpu),
    diffAfter: maxDiff(after, gpu),
    canvasMoved: maxDiff(before, after) > 0,
  };
}

/** `texImage2D` from a `<video>`: paused at three times, then twelve frames while it plays. */
export async function checkVideo(url: string) {
  const runner = createGpuRunner();
  const video = await loadVideo(url);
  try {
    const { videoWidth: w, videoHeight: h } = video;
    const x = Math.round(w * 0.73);
    const y = Math.round(h * 0.74);
    const paused = [];
    for (const time of [0.5, 2.2, 4.1]) {
      await seekTo(video, time);
      paused.push(compareFrame(runner, video, x, y));
    }
    await video.play();
    const playing = [];
    for (let n = 0; n < 12; n++) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      playing.push(
        await new Promise<ReturnType<typeof compareFrame>>((resolve) => {
          const take = () => resolve(compareFrame(runner, video, x, y));
          if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(take);
          else take();
        }),
      );
    }
    const same = (f: ReturnType<typeof compareFrame>) => f.diffBefore <= 1 || f.diffAfter <= 1;
    return {
      size: [w, h],
      rvfc: typeof video.requestVideoFrameCallback === "function",
      nonBlack: [...paused, ...playing].every((f) => f.gpuMean > 8),
      pausedExact: paused.every((f) => f.diffBefore === 0),
      playingMatchesACanvasDraw: playing.filter(same).length,
      playingCanvasMovedMidCheck: playing.filter((f) => f.canvasMoved).length,
      paused,
      playing,
    };
  } finally {
    release(video);
    runner.dispose();
  }
}

/** Black, mid-gray and white stripes: what the 2D canvas and the GPU upload each hold. */
export async function checkLevels(url: string) {
  const runner = createGpuRunner();
  const video = await loadVideo(url);
  try {
    await seekTo(video, 0.1);
    const width = video.videoWidth;
    const height = video.videoHeight;
    const stripes = [1, 3, 5].map((sixth) => {
      const x = Math.round((width * sixth) / 6) - 2;
      const y = (height >> 1) - 2;
      const canvas = region(video, width, height, x, y);
      const gpu = region(runner.run(video, { width, height }, [IDENTITY]), width, height, x, y);
      return { canvas: mean(canvas), gpu: mean(gpu) };
    });
    return {
      size: [width, height],
      black: stripes[0],
      gray: stripes[1],
      white: stripes[2],
    };
  } finally {
    release(video);
    runner.dispose();
  }
}
