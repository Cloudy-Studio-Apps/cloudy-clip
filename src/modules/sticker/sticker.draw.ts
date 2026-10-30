import { microsToSeconds } from "@/core";
import type { DrawEnv } from "@/modules/element";
import type { StickerArt, StickerArtCache } from "./sticker.types";

/** Marks a sticker with no picture, so the clip stays visible and movable. */
function drawPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const line = Math.max(2, Math.min(width, height) * 0.02);
  ctx.lineWidth = line;
  ctx.setLineDash([line * 3, line * 3]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.strokeRect(-width / 2, -height / 2, width, height);
}

/** Draws a sticker at `env.placement`, or a placeholder when it has no picture to show. */
export function drawSticker(
  ctx: CanvasRenderingContext2D,
  art: StickerArt | undefined,
  cache: StickerArtCache,
  env: DrawEnv,
): void {
  const { placement: place, kx, ky } = env;
  ctx.save();
  ctx.setTransform(kx, 0, 0, ky, 0, 0);
  ctx.translate(place.cx, place.cy);
  ctx.rotate((place.rotation * Math.PI) / 180);
  const box = { width: place.width, height: place.height };
  const seconds = microsToSeconds(env.time);
  const drawn = art && cache.draw(ctx, art, seconds, box, place.width * kx);
  if (!drawn) drawPlaceholder(ctx, place.width, place.height);
  ctx.restore();
}
