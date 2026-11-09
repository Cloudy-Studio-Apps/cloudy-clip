import { createStore } from "zustand/vanilla";
import type { ClipId } from "@/modules/project";
import type { LiveGrade, TintLive, TintView } from "./tint.types";

/** The page's view state for one kernel: Baby Seal on Basics, with the demo's Skin layer selected. */
export function createTintView() {
  return createStore<TintView>()(() => ({
    mode: "baby",
    tool: "basics",
    wheels: "primary",
    level: "clip",
    scope: "parade",
    curve: "custom",
    leftTab: "grade",
    selected: "n3",
    family: 1,
    bypass: false,
    compare: false,
    falseColor: false,
    warning: false,
    guides: false,
    samples: false,
    clean: false,
  }));
}

/**
 * Live grade values for one kernel: what a drag shows before its command runs. Never in history.
 * Each change calls `redraw` (the preview's) and then the subscribers.
 */
export function createTintLive(redraw: () => void): TintLive {
  const grades = new Map<ClipId, LiveGrade>();
  const listeners = new Set<() => void>();
  return {
    get: (clipId) => grades.get(clipId),
    set(clipId, live) {
      if (live) grades.set(clipId, live);
      else if (!grades.delete(clipId)) return;
      redraw();
      for (const fn of listeners) fn();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
