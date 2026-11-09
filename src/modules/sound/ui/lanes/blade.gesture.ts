import { notify } from "@/core";
import { splitAt } from "@/modules/timeline";
import { bladeTargets } from "../../logic/blade";
import type { BladeCut } from "../../sound.types";

/**
 * Cuts with the blade: one `timeline.splitAt` (the command the toolbar's Split and S send), on the
 * clip clicked, or with Shift on every clip under that time. It fails as a split does, and the user
 * is told.
 */
export function sendCut({ bus, clips, hit, at, every }: BladeCut): void {
  const clipIds = bladeTargets(clips, hit, at, every);
  if (clipIds.length === 0) {
    notify("info", every ? "No clip to cut there." : "Click a clip to cut it.");
    return;
  }
  void bus.run(splitAt, { at, clipIds }).then((result) => {
    if (!result.ok) notify("error", result.error.message);
  });
}
