import { useEffect, useState } from "react";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { useOpenComposition, type ClipGrade, type GradeNodeId } from "@/modules/project";
import { tintRef } from "../tint.ref";
import type { GradeSubject } from "./ui.types";

const NONE: Record<GradeNodeId, string> = {};
const WIDTH = 96;
const HEIGHT = 54;
/** How long after the last change a thumbnail is drawn. */
const SETTLE_MS = 400;

/** A capture shrunk to thumbnail size, as an object URL. */
async function shrink(dataUrl: string): Promise<string> {
  const image = new Image();
  image.src = dataUrl.startsWith("data:") ? dataUrl : `data:image/png;base64,${dataUrl}`;
  await image.decode();
  const canvas = new OffscreenCanvas(WIDTH, HEIGHT);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d context");
  context.drawImage(image, 0, 0, WIDTH, HEIGHT);
  return URL.createObjectURL(await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 }));
}

/**
 * Small pictures (object URLs, 96 by 54) of the current clip as each node of the subject's grade
 * leaves it (the levels before drawn whole, the ones after not at all: `TintApi.thumb`), drawn 400 ms after the
 * last change to the grade, the live values or the playhead, and never while playing. A node whose
 * picture can't be drawn has none (the row shows the plain frame); nothing is reported.
 */
export function useNodeThumbs(
  subject: Pick<GradeSubject, "clipId" | "level">,
  grade: ClipGrade | null,
  nodeIds: readonly GradeNodeId[],
): Record<GradeNodeId, string> {
  const tint = useModule(tintRef);
  const { playback } = useModule(previewRef);
  const compositionId = useOpenComposition()?.id;
  const [thumbs, setThumbs] = useState<Record<GradeNodeId, string>>({});
  const key = nodeIds.join(" ");
  const { clipId, level } = subject;
  useEffect(() => {
    if (!grade || !compositionId || nodeIds.length === 0) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stale = false;
    let round = 0;
    let urls: string[] = [];
    const draw = async () => {
      const mine = ++round;
      const time = playback.getTime();
      const made: Record<GradeNodeId, string> = {};
      const fresh: string[] = [];
      for (const id of nodeIds) {
        if (stale || mine !== round || playback.isPlaying()) break;
        try {
          const url = await shrink(await tint.thumb(clipId, id, time, compositionId, level));
          made[id] = url;
          fresh.push(url);
        } catch {
          // The row shows the plain frame.
        }
      }
      if (stale || mine !== round) {
        fresh.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls = fresh;
      setThumbs(made);
    };
    const schedule = () => {
      clearTimeout(timer);
      round++;
      if (!playback.isPlaying()) timer = setTimeout(() => void draw(), SETTLE_MS);
    };
    schedule();
    const off = [
      playback.onTime(() => !playback.isPlaying() && schedule()),
      playback.onPlayingChange(schedule),
      tint.live.subscribe(schedule),
    ];
    return () => {
      stale = true;
      clearTimeout(timer);
      off.forEach((fn) => fn());
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for nodeIds.
  }, [tint, playback, clipId, level, grade, compositionId, key]);
  return nodeIds.length > 0 ? thumbs : NONE;
}
