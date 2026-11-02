import { useMemo } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import {
  EASE_PRESETS,
  presetOf,
  projectRef,
  type Clip,
  type EasePresetId,
} from "@/modules/project";
import { cn } from "@/ui";
import { PRESET_STRIP_HEIGHT } from "../keyframe.layout";
import { setEase } from "../keyframe.ease.commands";
import { keyframeRef } from "../keyframe.ref";
import type { KeyRef } from "../keyframe.types";
import { EaseThumb } from "./EaseThumb";
import { report } from "./panel.actions.hook";

/** The preset every selected key has, `"custom"` when they agree on none, null when they differ. */
function sharedPreset(
  clips: Readonly<Record<string, Clip>>,
  selection: readonly KeyRef[],
): EasePresetId | "custom" | null {
  const found = selection.flatMap((ref) => {
    const key = clips[ref.clipId]?.animation?.[ref.path]?.keys.find((k) => k.id === ref.keyId);
    return key ? [presetOf(key.ease)] : [];
  });
  const first = found[0];
  return first !== undefined && found.every((p) => p === first) ? first : null;
}

/**
 * Under the panel in Keyframes and Curves: every preset as a thumbnail, applied to the selected
 * keys with a click, and Custom, which marks a curve that is none of them and can't be clicked.
 */
export function PresetStrip() {
  const { bus } = useKernel();
  const { view } = useModule(keyframeRef);
  const clips = useStore(useModule(projectRef).store.api, (s) => s.clips);
  const selection = useStore(view, (s) => s.selection);
  const current = useMemo(() => sharedPreset(clips, selection), [clips, selection]);
  const none = selection.length === 0;

  return (
    <div
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-border-strong bg-muted px-2"
      style={{ height: PRESET_STRIP_HEIGHT }}
    >
      <span className="mr-1 shrink-0 font-hand text-sm font-bold text-muted-foreground">
        Curve after this key
      </span>
      {EASE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          disabled={none}
          title={preset.label}
          className={cn(
            "flex shrink-0 cursor-pointer flex-col items-center rounded-xs border px-1.5 pb-0.5 text-muted-foreground hover:bg-hover hover:text-foreground disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent",
            current === preset.id ? "border-mark text-foreground" : "border-transparent",
          )}
          onClick={() =>
            void bus
              .run(setEase, {
                changes: selection.map((key) => ({ key, ease: preset.id })),
              })
              .then(report)
          }
        >
          <EaseThumb ease={preset.ease} />
          <span className="text-2xs leading-3">{preset.label}</span>
        </button>
      ))}
      <div
        title="A curve you shaped with the handles"
        className={cn(
          "flex shrink-0 flex-col items-center rounded-xs border border-dashed px-1.5 pb-0.5 text-subtle-foreground",
          current === "custom" ? "border-mark text-foreground" : "border-border-strong",
        )}
      >
        <svg width={42} height={24} viewBox="0 0 42 24" aria-hidden>
          <path
            d="M0 22C4 6 26 26 42 4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray="3 2"
          />
        </svg>
        <span className="text-2xs leading-3">Custom</span>
      </div>
    </div>
  );
}
