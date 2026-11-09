import { useEffect } from "react";
import { notify, useModule } from "@/core";
import { tintRef } from "../tint.ref";
import { useEditTarget } from "./edit.target.hook";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

/**
 * Over the viewer while a tool picks a color (`view.picking`: Curves' Pick hue, Color mix's Pick,
 * Limit's droppers): a click on the picture reads the color the edited correction gets there
 * (`TintApi.pickColor`: the clip's own ungraded picture through the corrections above it), hands
 * it to the tool (`view.picked`) and stops picking. A click off the frame or off the clip's
 * picture keeps picking; Escape stops without a pick.
 */
export function ViewerPicker({ stage }: { stage: React.RefObject<HTMLElement | null> }) {
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
      if (rgb) set({ picking: false, picked: rgb });
    } catch (error) {
      notify("error", `Couldn't read the color there: ${String(error)}`);
      set({ picking: false });
    }
  };
  return (
    <div
      onPointerDown={(event) => void pick(event)}
      className="absolute inset-0 z-10 cursor-crosshair"
      title="Click a color in the picture (Escape stops)"
    />
  );
}
