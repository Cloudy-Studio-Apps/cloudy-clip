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
 * Measures how this webview draws video levels, once per kind of color tags
 * (`ProbeMeta.colorTags`), on `media`'s levels clip for that kind, for every engine of the
 * kernel. WebKitGTK draws some kinds right and squeezes others, so one measure can't speak for
 * all. A failed measure is forgotten, so the next `measure` tries again. `onFound` is told when a
 * kind turns out to need correcting.
 */
export function createVideoLevelsMeter(
  media: Pick<MediaApi, "levelsClip" | "masterUrl">,
  log: Logger,
  onFound: () => void,
): VideoLevelsMeter {
  const known = new Map<string, VideoLevels | null>();
  const measuring = new Map<string, Promise<VideoLevels | null>>();
  const first = new Map<string, Promise<void>>();
  const settle = (tags: string) => {
    let done = first.get(tags);
    if (!done) {
      done = meter.measure(tags).then(
        (found) => {
          if (found) onFound();
        },
        (error: unknown) => log.warn(`Could not measure video levels of ${tags}`, error),
      );
      first.set(tags, done);
    }
    return done;
  };
  const meter: VideoLevelsMeter = {
    current(tags) {
      // A kind not measured (or not measurable) draws as it is: expanding a picture that is
      // already right crushes its blacks and whites for good, a squeezed one only looks flat.
      if (tags === undefined) return null;
      void settle(tags);
      return known.get(tags) ?? null;
    },
    settled: (tags) => Promise.all([...new Set(tags)].map(settle)).then(() => undefined),
    measure(tags) {
      let measure = measuring.get(tags);
      if (!measure) {
        measure = media
          .levelsClip(tags)
          .then((id) => measureVideoLevels(media.masterUrl(id)))
          .then(({ black, white }) => {
            log.info(`Video tagged ${tags} draws from ${black} to ${white}`);
            // A frame that wasn't decoded reads as nonsense, which would wreck every video layer.
            if (black > 64 || white < 192) throw new Error(`Unlikely levels: ${black} to ${white}`);
            const right = black <= LEVELS_TOLERANCE && white >= 255 - LEVELS_TOLERANCE;
            const levels = right ? null : { black, white };
            known.set(tags, levels);
            return levels;
          })
          .catch((error: unknown) => {
            measuring.delete(tags);
            throw error;
          });
        measuring.set(tags, measure);
      }
      return measure;
    },
  };
  return meter;
}
