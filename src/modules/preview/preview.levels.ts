import type { Logger } from "@/core";
import type { MediaApi } from "@/modules/media";
import type { VideoLevels, VideoLevelsMeter } from "./preview.types";

/** A webview this close to black 0 and white 255 draws video as it should. */
const LEVELS_TOLERANCE = 6;

/** A frame that never arrives is reported, not waited on forever. */
const LOAD_LIMIT_MS = 10_000;
/** After `seeked`, time for the frame to be decoded where `requestVideoFrameCallback` can't say. */
const FRAME_FALLBACK_MS = 300;

/** Measures how video is drawn on a canvas, on a clip of black on the left and white on the right. */
export async function measureVideoLevels(url: string): Promise<VideoLevels> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  // Silenced with volume: WebKitGTK draws a `muted` video's frames as black.
  video.volume = 0;
  video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("The levels clip did not load")),
        LOAD_LIMIT_MS,
      );
      video.addEventListener("error", () => reject(new Error("The levels clip did not load")));
      video.addEventListener("loadeddata", () => {
        clearTimeout(timer);
        resolve();
      });
      video.src = url;
    });
    video.currentTime = 0.1;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, FRAME_FALLBACK_MS);
      video.requestVideoFrameCallback?.(() => resolve());
    });
    const deadline = performance.now() + LOAD_LIMIT_MS;
    while (video.seeking || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (performance.now() > deadline) throw new Error("The levels clip did not decode");
      await new Promise((resolve) => setTimeout(resolve, FRAME_FALLBACK_MS));
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas is not available");
    ctx.drawImage(video, 0, 0);
    const sample = (x: number) => ctx.getImageData(x, canvas.height >> 1, 1, 1).data[1]!;
    return { black: sample(canvas.width >> 2), white: sample((canvas.width * 3) >> 2) };
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

/**
 * Measures this webview's video levels once, on `media`'s levels clip, for every engine of the
 * kernel. A failed measure is forgotten, so the next ask tries again.
 */
export function createVideoLevelsMeter(
  media: Pick<MediaApi, "levelsClip" | "masterUrl">,
  log: Logger,
): VideoLevelsMeter {
  let known: VideoLevels | null = null;
  let measuring: Promise<VideoLevels | null> | null = null;
  let first: Promise<void> | null = null;
  const meter: VideoLevelsMeter = {
    current: () => known,
    settled() {
      first ??= meter.measure().then(
        () => undefined,
        () => undefined,
      );
      return first;
    },
    measure() {
      measuring ??= media
        .levelsClip()
        .then((id) => measureVideoLevels(media.masterUrl(id)))
        .then(({ black, white }) => {
          log.info(`Video draws from ${black} to ${white}`);
          // A frame that wasn't decoded reads as nonsense, which would wreck every video layer.
          if (black > 64 || white < 192) throw new Error(`Unlikely levels: ${black} to ${white}`);
          const right = black <= LEVELS_TOLERANCE && white >= 255 - LEVELS_TOLERANCE;
          known = right ? null : { black, white };
          return known;
        })
        .catch((error: unknown) => {
          measuring = null;
          throw error;
        });
      return measuring;
    },
  };
  return meter;
}
