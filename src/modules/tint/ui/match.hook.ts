import { useCallback, useEffect } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { timelineRef } from "@/modules/timeline";
import { tintRef } from "../tint.ref";
import { match } from "../tint.match.commands";
import type { FramePoint, StripClip } from "../tint.types";
import { useEditTarget } from "./edit.target.hook";
import { settle } from "./settle";
import { useStrip } from "./strip.hook";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

/**
 * What Match, Basics' One click and the strip run: `tint.match` on the current clip's own grade
 * (only at the clip level), balance into the correction the tools edit. `pick` starts Pick white or
 * gray (`view.picking` with `view.balancePick`); the open tool's `useMatchTool` balances where the
 * click lands. `others` are the strip's selected clips other than the current one: Match to takes
 * the first, Match all to this takes them all.
 */
export function useMatch() {
  const { bus } = useKernel();
  const { subject, nodeId } = useEditTarget();
  const selection = useStore(useModule(timelineRef).view, (s) => s.selection);
  const strip = useStrip();
  const balancePick = useTintView((v) => v.balancePick);
  const set = useTintSet();
  const clipId = subject?.level === "clip" ? subject.clipId : null;
  const others: StripClip[] = strip.filter(
    (entry) => entry.clip.id !== clipId && selection.includes(entry.clip.id),
  );
  const balance = useCallback(
    (kind: "auto" | "white" | "gray", point?: FramePoint) => {
      if (!clipId) return;
      void settle(
        bus.run(match, {
          clipIds: [clipId],
          kind,
          ...(point ? { point } : {}),
          ...(nodeId ? { nodeId } : {}),
        }),
      );
    },
    [bus, clipId, nodeId],
  );
  return {
    /** False away from the clip level or without a clip. */
    enabled: clipId !== null,
    clipId,
    others,
    balancePick,
    balance,
    auto: () => balance("auto"),
    /** Waits for a click on something white or gray in the viewer; again stops waiting. */
    pick(kind: "white" | "gray") {
      const again = balancePick === kind;
      set({ picking: !again, balancePick: again ? null : kind, picked: null, pickedAt: null });
    },
    /** Matches `clipIds` to `from`. */
    shot(clipIds: string[], from: string) {
      void settle(bus.run(match, { clipIds, kind: "shot", from }));
    },
  };
}

/**
 * `useMatch` for the open tool (Match, Basics): a Pick white or gray click in the viewer
 * (`ViewerPicker` puts the point in `view.pickedAt`) balances there, and leaving the tool stops
 * waiting. Only the open tool listens, so a click runs once.
 */
export function useMatchTool() {
  const m = useMatch();
  const tint = useModule(tintRef);
  const pickedAt = useTintView((v) => v.pickedAt);
  const set = useTintSet();
  const { balancePick, balance } = m;
  useEffect(() => {
    if (!balancePick || !pickedAt) return;
    set({ picked: null, pickedAt: null, balancePick: null });
    balance(balancePick, pickedAt);
  }, [balancePick, pickedAt, balance, set]);
  useEffect(
    () => () => {
      if (tint.view.getState().balancePick) set({ picking: false, balancePick: null });
    },
    [tint, set],
  );
  return m;
}
