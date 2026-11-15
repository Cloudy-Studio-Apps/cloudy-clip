import { useEffect, useMemo, useState, type RefObject } from "react";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { useOpenComposition, type Clip, type ClipGrade } from "@/modules/project";
import type { LookDef } from "../../tint.types";
import { previewGrade } from "../../logic/look";
import { tintRef } from "../../tint.ref";
import type { GradeSubject } from "../ui.types";

/** How long after the playhead stops a card is drawn. */
const SETTLE_MS = 400;

/**
 * The current frame of a clip as `extra` would leave it added to the grade being edited
 * (`subject`: the clip's own, its shot group's or the whole timeline's; the other levels drawn as
 * saved) (a data URL), for a look card. Drawn only once the card is on screen, 400 ms after the playhead settles and never
 * while playing; the kernel keeps what it drew, so a card seen again costs nothing. Undefined until
 * drawn (or when it can't be: the card then shows its fallback).
 */
export function useLookThumb(
  card: RefObject<Element | null>,
  clip: Clip | undefined,
  extra: LookDef | ClipGrade | undefined,
  subject: Pick<GradeSubject, "grade" | "level"> | null,
): string | undefined {
  const tint = useModule(tintRef);
  const { playback } = useModule(previewRef);
  const compositionId = useOpenComposition()?.id;
  const [seen, setSeen] = useState(false);
  const [url, setUrl] = useState<string>();
  const clipId = clip?.id;
  const base = subject?.grade ?? null;
  const level = subject?.level ?? "clip";
  // Everything of the clip but its grade: a trim, move, transform or speed change redraws the card.
  const signature = useMemo(() => JSON.stringify({ ...clip, grade: undefined }), [clip]);
  const grade = useMemo(() => (extra ? previewGrade(base, extra) : null), [base, extra]);
  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const watch = new IntersectionObserver(([entry]) => setSeen(entry?.isIntersecting ?? false));
    watch.observe(element);
    return () => watch.disconnect();
  }, [card]);
  useEffect(() => {
    if (!seen || !clipId || !compositionId || !grade) return;
    let stale = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const draw = () => {
      if (playback.isPlaying()) return;
      tint.lookThumb(clipId, signature, grade, playback.getTime(), compositionId, level).then(
        (picture) => !stale && setUrl(picture),
        () => {},
      );
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(draw, SETTLE_MS);
    };
    schedule();
    const off = [
      playback.onTime(() => !playback.isPlaying() && schedule()),
      playback.onPlayingChange(schedule),
    ];
    return () => {
      stale = true;
      clearTimeout(timer);
      off.forEach((fn) => fn());
    };
  }, [tint, playback, seen, clipId, signature, compositionId, grade, level]);
  return url;
}
