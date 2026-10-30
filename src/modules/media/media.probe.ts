import { createLogger, secondsToMicros, type Micros } from "@/core";
import type { MediaAsset } from "@/modules/project";
import type { MediaFrames, MediaState, ProbeQueue } from "./media.types";

const log = createLogger("media.probe");

/** Files probed at the same time. Each probe holds a decoder, so keep this small. */
const CONCURRENCY = 2;
const LOAD_TIMEOUT_MS = 15_000;
const POSTER_WIDTH = 192;
/** Length a still lands at on the timeline. */
const STILL_DURATION: Micros = 5_000_000;
/** Size of an SVG that doesn't say. */
const UNSIZED_IMAGE = 1024;

/** Creates the probe queue of one kernel, reading from `mediaUrl` and writing into `state`. */
export function createProbeQueue(deps: {
  state: MediaState;
  mediaUrl(id: string): string;
  frameUrl: MediaFrames;
}): ProbeQueue {
  const { state } = deps;
  const queue: MediaAsset[] = [];
  const queued = new Set<string>();
  let running = 0;
  let disposed = false;

  function pump(): void {
    while (!disposed && running < CONCURRENCY && queue.length > 0) {
      const asset = queue.shift()!;
      running++;
      const reading =
        asset.kind === "image" ? probeImage(asset, deps) : probe(asset, deps.mediaUrl(asset.id));
      void reading
        .then((probe) => {
          if (!disposed) state.setProbe(asset.id, { ...probe, status: "ready" });
        })
        .catch((error: unknown) => {
          if (disposed) return;
          let message = error instanceof Error ? error.message : String(error);
          // Explain why there is no proxy to fall back on (e.g. FFmpeg is missing).
          const proxy = state.getProbe(asset.id)?.proxy;
          if (proxy?.state !== "ready" && proxy?.message) message = `${message}. ${proxy.message}`;
          log.warn(`Could not read "${asset.name}"`, message);
          state.setProbe(asset.id, { status: "error", error: message });
        })
        .finally(() => {
          running--;
          pump();
        });
    }
  }

  return {
    enqueue(asset) {
      if (disposed || queued.has(asset.id)) return;
      queued.add(asset.id);
      state.setProbe(asset.id, { status: "pending" });
      queue.push(asset);
      pump();
    },
    forget(id) {
      queued.delete(id);
      const index = queue.findIndex((asset) => asset.id === id);
      if (index >= 0) queue.splice(index, 1);
    },
    dispose() {
      disposed = true;
      queue.length = 0;
    },
  };
}

/** Reads an image's size and poster from a plain `Image`: it has no decoder to hold. */
async function probeImage(asset: MediaAsset, deps: Parameters<typeof createProbeQueue>[0]) {
  const animation = deps.state.animation(asset.id);
  const url = animation ? deps.frameUrl(asset.id, 0) : deps.mediaUrl(asset.id);
  const image = await loadImage(url);
  const meta = animation ? deps.state.getProbe(asset.id)?.proxy?.meta : undefined;
  const width = meta?.width ?? (image.naturalWidth || UNSIZED_IMAGE);
  const height = meta?.height ?? (image.naturalHeight || UNSIZED_IMAGE);
  const posterUrl = await drawPoster(image, width / height, "image/png").catch(() => undefined);
  return { duration: meta?.duration ?? STILL_DURATION, width, height, posterUrl };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(
      () => reject(new Error("Timed out reading the file")),
      LOAD_TIMEOUT_MS,
    );
    image.crossOrigin = "anonymous";
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("This image can't be read"));
    };
    image.src = url;
  });
}

async function probe(asset: MediaAsset, url: string) {
  const element = document.createElement(asset.kind === "video" ? "video" : "audio");
  element.preload = "metadata";
  element.crossOrigin = "anonymous";
  // Silent with volume, not `muted`: WebKitGTK hands a muted <video>'s frames to a canvas as
  // black, so the poster would come out black.
  element.volume = 0;
  try {
    element.src = url;
    await waitFor(element, "loadedmetadata");

    if (!Number.isFinite(element.duration) || element.duration <= 0) {
      throw new Error("The file has no readable duration");
    }
    const duration = secondsToMicros(element.duration);
    if (!(element instanceof HTMLVideoElement)) return { duration };

    if (element.videoWidth === 0) throw new Error("The video track cannot be decoded");
    const posterUrl = await capturePoster(element).catch(() => undefined);
    return { duration, width: element.videoWidth, height: element.videoHeight, posterUrl };
  } finally {
    // Release the decoder and the stream right away.
    element.removeAttribute("src");
    element.load();
  }
}

async function capturePoster(video: HTMLVideoElement): Promise<string> {
  video.currentTime = Math.min(1, video.duration * 0.1);
  await waitFor(video, "seeked");
  await waitForDecodedFrame(video);
  return drawPoster(video, video.videoWidth / video.videoHeight, "image/jpeg");
}

/** Encodes a small copy of a picture. Images use PNG, so a transparent one doesn't turn black. */
async function drawPoster(
  picture: CanvasImageSource,
  aspect: number,
  type: "image/jpeg" | "image/png",
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH;
  canvas.height = Math.max(1, Math.round(POSTER_WIDTH / aspect));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D context");
  ctx.drawImage(picture, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.8));
  if (!blob) throw new Error("Could not encode poster");
  return URL.createObjectURL(blob);
}

/**
 * WebKit fires `seeked` before the new frame is decoded, so drawing right away can capture a
 * black image. Waits for the frame to be presented (or a short fallback delay).
 */
function waitForDecodedFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 500);
    if ("requestVideoFrameCallback" in video) {
      video.requestVideoFrameCallback(() => {
        clearTimeout(timer);
        resolve();
      });
    }
  });
}

function waitFor(element: HTMLMediaElement, event: "loadedmetadata" | "seeked"): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error("Timed out reading the file")), LOAD_TIMEOUT_MS);
    const onEvent = () => done();
    const onError = () => done(new Error(describeMediaError(element.error)));
    function done(error?: Error) {
      clearTimeout(timer);
      element.removeEventListener(event, onEvent);
      element.removeEventListener("error", onError);
      if (error) reject(error);
      else resolve();
    }
    element.addEventListener(event, onEvent, { once: true });
    element.addEventListener("error", onError, { once: true });
  });
}

function describeMediaError(error: MediaError | null): string {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_DECODE:
      return "The file is damaged or uses an unsupported codec";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "This format or codec is not supported on this system";
    case MediaError.MEDIA_ERR_NETWORK:
      return "The file could not be read";
    default:
      return error?.message || "Unknown media error";
  }
}
