import { useEffect } from "react";
import { notify, useModule } from "@/core";
import { hueOf } from "../logic/color/curves.apply";
import { tintRef } from "../tint.ref";
import { useEditTarget } from "./edit.target.hook";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

/**
 * Over the viewer while a tool picks a hue (`view.picking`: Curves' Pick hue, Color mix's Pick): a click on the picture reads
 * the color the edited correction gets there (`TintApi.pickColor`: the clip's own ungraded picture
 * through the corrections above it), hands its hue to the tool (`view.picked`) and stops picking.
 * A click off the frame or off the clip's picture keeps picking; Escape stops without a pick.
 */
export function HuePicker({ stage }: { stage: React.RefObject<HTMLElement | null> }) {
  const tint = useModule(tintRef);
  const picking = useTintView((v) => v.picking);
  const { clipId, nodeId } = useEditTarget();
  const set = useTintSet();
  useEffect(() => {
    if (!picking) return;
    const stop = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      set({ picking: false });
    };
    window.addEventListener("keydown", stop, true);
    return () => window.removeEventListener("keydown", stop, true);
  }, [picking, set]);
  if (!picking) return null;

  const pick = async (event: React.PointerEvent) => {
    const canvas = stage.current?.querySelector("canvas");
    if (!canvas || !clipId || event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const u = (event.clientX - rect.left) / rect.width;
    const v = (event.clientY - rect.top) / rect.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    try {
      const rgb = await tint.pickColor(clipId, nodeId, { u, v });
      if (!rgb) return;
      const hue = hueOf(rgb);
      if (hue === null) notify("info", "That color is a gray: it has no hue to pick.");
      set({ picking: false, picked: hue });
    } catch (error) {
      notify("error", `Couldn't read the color there: ${String(error)}`);
      set({ picking: false });
    }
  };
  return (
    <div
      onPointerDown={(event) => void pick(event)}
      className="absolute inset-0 z-10 cursor-crosshair"
      title="Click a color to pick its hue (Escape stops)"
    />
  );
}
