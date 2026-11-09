// TEMPORARY (Task 1 check): removed before the commit.
import type { FrameRenderer } from "../preview.types";
import { createGpuRunner } from "./gpu.runner";
import { canvas2d, exposure, IDENTITY, loadVideo, release, seekTo } from "./gpu.check.read";
import { compareFrame } from "./gpu.check.video";

/**
 * For `seconds`: every 2.5 s a frame of the `createRenderer` path goes through the runner and is
 * compared with the bytes it gave; a seeked `<video>` is uploaded and compared too.
 */
export async function checkHidden(
  renderer: FrameRenderer,
  size: { width: number; height: number },
  duration: number,
  seconds: number,
  videoUrl: string | null,
) {
  const runner = createGpuRunner();
  const video = videoUrl ? await loadVideo(videoUrl) : null;
  let frames = 0;
  const countFrames = () => {
    frames++;
    if (performance.now() < end) requestAnimationFrame(countFrames);
  };
  const start = performance.now();
  const end = start + seconds * 1000;
  requestAnimationFrame(countFrames);
  const runs = [];
  const hiddenSeen = new Set<boolean>();
  try {
    for (let n = 0; performance.now() < end; n++) {
      hiddenSeen.add(document.hidden);
      const time = Math.round(((n * 0.37) % 1) * duration);
      const bytes = await renderer.frameAt(time);
      const { canvas, ctx } = canvas2d(size.width, size.height);
      ctx.putImageData(new ImageData(new Uint8ClampedArray(bytes), size.width, size.height), 0, 0);
      const out = runner.run(canvas, size, [IDENTITY, exposure(1, 0.5)]);
      const back = canvas2d(size.width, size.height);
      back.ctx.drawImage(out, 0, 0);
      const read = back.ctx.getImageData(0, 0, size.width, size.height).data;
      let worst = 0;
      let off = 0;
      for (let i = 0; i < read.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const diff = Math.abs(read[i + c]! - bytes[i + c]! * 0.5);
          worst = Math.max(worst, diff);
          if (diff > 1) off++;
        }
      }
      let videoRun = null;
      if (video) {
        await seekTo(video, ((n * 0.53) % 1) * Math.max(0, video.duration - 0.2));
        videoRun = compareFrame(runner, video, video.videoWidth >> 1, (video.videoHeight >> 2) * 3);
      }
      runs.push({
        atMs: Math.round(performance.now() - start),
        time,
        rendererMean: Math.round(bytes.reduce((s, v) => s + v, 0) / bytes.length),
        halfMaxDiff: Math.round(worst * 10) / 10,
        halfOffByMoreThan1: off,
        video: videoRun,
      });
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    const elapsed = (performance.now() - start) / 1000;
    return {
      seconds: Math.round(elapsed * 10) / 10,
      rafPerSecond: Math.round((frames / elapsed) * 10) / 10,
      documentHidden: [...hiddenSeen],
      runs,
    };
  } finally {
    if (video) release(video);
    runner.dispose();
  }
}
