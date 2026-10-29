import { blockMask } from "../logic/noise";

/** Scratch objects kept per destination canvas (R9), so nothing is allocated per frame. */
interface Scratch {
  ghost?: HTMLCanvasElement;
  dissolve?: {
    key: string;
    values: Float32Array;
    canvas: HTMLCanvasElement;
    image: ImageData;
  };
}

const scratches = new WeakMap<object, Scratch>();

function scratchOf(owner: object): Scratch {
  let s = scratches.get(owner);
  if (!s) {
    s = {};
    scratches.set(owner, s);
  }
  return s;
}

/** A 2D canvas of this size owned by `owner`, resized only when the size changes; null if unavailable. */
export function ghostCanvas(
  owner: object,
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const s = scratchOf(owner);
  s.ghost ??= document.createElement("canvas");
  if (s.ghost.width !== width) s.ghost.width = width;
  if (s.ghost.height !== height) s.ghost.height = height;
  const ctx = s.ghost.getContext("2d");
  return ctx ? { canvas: s.ghost, ctx } : null;
}

/**
 * The dissolve mask as a `cols` x `rows` canvas (one pixel per block, opaque where the block's
 * threshold is below `progress`). Thresholds are cached per owner and seed; pixels are only written.
 */
export function dissolveCanvas(
  owner: object,
  cols: number,
  rows: number,
  seed: string,
  progress: number,
): HTMLCanvasElement | null {
  const s = scratchOf(owner);
  const key = `${seed}:${cols}x${rows}`;
  if (s.dissolve?.key !== key) {
    const canvas = document.createElement("canvas");
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    s.dissolve = {
      key,
      values: blockMask(cols, rows, 1, seed),
      canvas,
      image: ctx.createImageData(cols, rows),
    };
  }
  const { values, canvas, image } = s.dissolve;
  const data = image.data;
  for (let i = 0; i < values.length; i++) data[i * 4 + 3] = (values[i] ?? 1) < progress ? 255 : 0;
  canvas.getContext("2d")?.putImageData(image, 0, 0);
  return canvas;
}
