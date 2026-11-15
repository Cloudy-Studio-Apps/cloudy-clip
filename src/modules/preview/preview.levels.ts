import type { Logger } from "@/core";
import type { MediaApi, VideoMatrix } from "@/modules/media";
import { decodedYellow } from "./logic/matrix";
import type { DecoderMatrices, VideoLevels, VideoLevelsMeter } from "./preview.types";

/** A webview this close to black 0 and white 255 draws video as it should. */
const LEVELS_TOLERANCE = 6;

/** A frame that never arrives is reported, not waited on forever. */
const LOAD_LIMIT_MS = 10_000;
/** After `seeked`, time for the frame to be decoded where `requestVideoFrameCallback` can't say. */
const FRAME_FALLBACK_MS = 300;

/** Draws a test clip's frame at 0.1 s on a canvas of its size and reads it with `read`. */
async function readVideo<T>(url: string, read: (ctx: CanvasRenderingContext2D) => T): Promise<T> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  // Silenced with volume: WebKitGTK draws a `muted` video's frames as black.
  video.volume = 0;
  video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("A test clip did not load")), LOAD_LIMIT_MS);
      video.addEventListener("error", () => reject(new Error("A test clip did not load")));
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
      if (performance.now() > deadline) throw new Error("A test clip did not decode");
      await new Promise((resolve) => setTimeout(resolve, FRAME_FALLBACK_MS));
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas is not available");
    ctx.drawImage(video, 0, 0);
    return read(ctx);
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

/** Measures how video is drawn on a canvas, on a clip of black on the left and white on the right. */
export function measureVideoLevels(url: string): Promise<VideoLevels> {
  return readVideo(url, (ctx) => {
    const { width, height } = ctx.canvas;
    const sample = (x: number) => ctx.getImageData(x, height >> 1, 1, 1).data[1]!;
    return { black: sample(width >> 2), white: sample((width * 3) >> 2) };
  });
}

/** Which matrix drew a matrix clip (`MediaApi.matrixClip`), from its middle pixel. */
export function measureVideoMatrix(url: string): Promise<VideoMatrix | null> {
  return readVideo(url, (ctx) => {
    const { width, height } = ctx.canvas;
    const [r = 0, g = 0, b = 0] = ctx.getImageData(width >> 1, height >> 1, 1, 1).data;
    return decodedYellow([r, g, b]);
  });
}

/**
 * Measures this webview's video levels once, on `media`'s levels clip, for every engine of the
 * kernel. A failed measure is forgotten, so the next ask tries again.
 */
export function createVideoLevelsMeter(
  media: Pick<MediaApi, "levelsClip" | "matrixClip" | "masterUrl">,
  log: Logger,
): VideoLevelsMeter {
  let known: VideoLevels | null = null;
  let matrices: DecoderMatrices = { untagged: null, tagged: null };
  // A matrix that can't be told is left alone (no correction), never a reason to fail the levels.
  const matrixOf = (tagged: boolean) =>
    media
      .matrixClip(tagged)
      .then((id) => measureVideoMatrix(media.masterUrl(id)))
      .catch((error: unknown) => {
        log.warn("Could not measure the video matrix", error);
        return null;
      });
  let measuring: Promise<VideoLevels | null> | null = null;
  let first: Promise<void> | null = null;
  const meter: VideoLevelsMeter = {
    current: () => known,
    matrices: () => matrices,
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
        })
        .then(async () => {
          matrices = { untagged: await matrixOf(false), tagged: await matrixOf(true) };
          log.info(
            `HD video decodes untagged as ${matrices.untagged}, tagged BT.709 as ${matrices.tagged}`,
          );
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
