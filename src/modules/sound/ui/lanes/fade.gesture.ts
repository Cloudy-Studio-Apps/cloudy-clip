import { notify } from "@/core";
import { setSound, startFadeGesture } from "@/modules/audio";
import { soundOf } from "@/modules/project";
import { timeToPx } from "@/modules/timeline";
import { fadeEdgeAt } from "../../logic/blade";
import type { FadeDrag } from "../../sound.line.types";

/**
 * Drags a fade from a clip's nearer edge with the Fade tool: audio's own fade gesture (the clip's
 * handles use it too), shown over the clip through `show`, and one `audio.setSound` on release.
 * Escape puts it back.
 */
export function startFadeDrag({ down, bus, clip, box, pxPerSecond, show }: FadeDrag): void {
  const edge = fadeEdgeAt(down.clientX, box);
  const sound = soundOf(clip);
  const current = edge === "in" ? sound.fadeIn : sound.fadeOut;
  const shown = (fade: number) => {
    const width = Math.min(box.width, timeToPx(fade, pxPerSecond));
    show({ left: edge === "in" ? box.left : box.left + box.width - width, width });
  };
  const end = new AbortController();
  const hide = () => {
    show(null);
    end.abort();
  };
  window.addEventListener("pointerup", hide, { signal: end.signal });
  window.addEventListener("pointercancel", hide, { signal: end.signal });
  window.addEventListener("keydown", (e) => e.key === "Escape" && hide(), {
    capture: true,
    signal: end.signal,
  });
  shown(current);
  startFadeGesture({
    down,
    edge,
    current,
    duration: clip.duration,
    pxPerSecond,
    onPreview: shown,
    onDrop(fade) {
      const patch = edge === "in" ? { fadeIn: fade } : { fadeOut: fade };
      void bus.run(setSound, { clipIds: [clip.id], patch }).then((result) => {
        if (!result.ok) notify("error", result.error.message);
      });
    },
  });
}
