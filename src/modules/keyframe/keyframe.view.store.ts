import { createStore, type StoreApi } from "zustand/vanilla";
import type { Clip } from "@/modules/project";
import type { KeyframeViewState, KeyRef } from "./keyframe.types";

/** The panel's state, per kernel and never in history. */
export function createKeyframeView(): StoreApi<KeyframeViewState> {
  return createStore<KeyframeViewState>(() => ({
    mode: "normal",
    last: "keys",
    maximized: false,
    scope: "selected",
    folded: [],
    selection: [],
    shown: [],
    primary: null,
    panelHeight: 240,
    focused: false,
  }));
}

/** Whether a key is still in the project. */
function exists(clips: Readonly<Record<string, Clip>>, ref: KeyRef): boolean {
  return clips[ref.clipId]?.animation?.[ref.path]?.keys.some((k) => k.id === ref.keyId) ?? false;
}

/** Drops the selected keys that no longer exist (after an undo, or an agent's delete). */
export function pruneSelection(
  view: StoreApi<KeyframeViewState>,
  clips: Readonly<Record<string, Clip>>,
): void {
  const { selection } = view.getState();
  const kept = selection.filter((ref) => exists(clips, ref));
  if (kept.length !== selection.length) view.setState({ selection: kept });
}
