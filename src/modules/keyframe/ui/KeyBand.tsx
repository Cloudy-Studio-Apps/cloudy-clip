import { Fragment, useMemo } from "react";
import { timeToPx } from "@/modules/timeline";
import type { Clip, KeyTrack } from "@/modules/project";
import { SCROLL_VAR } from "../keyframe.layout";
import type { PanelWindow } from "../keyframe.types";
import { keysInWindow } from "../logic/range";
import { KeyDiamond } from "./KeyDiamond";

/** What a band slides by: the timeline's scroll, kept on the panel as a CSS variable. */
export const SCROLLED = { transform: `translateX(calc(var(${SCROLL_VAR}, 0px) * -1))` } as const;

interface KeyBandProps {
  clip: Clip;
  path: string;
  track: KeyTrack;
  scale: PanelWindow;
  selectedIds: ReadonlySet<string>;
}

/** The keys of one field along the timeline's scale: only the ones in the page window are drawn. */
export function KeyBand({ clip, path, track, scale, selectedIds }: KeyBandProps) {
  const { pxPerSecond, from, to } = scale;
  const keys = useMemo(() => keysInWindow(track, clip, from, to), [track, clip, from, to]);
  const step = track.blend === "step";
  return (
    <div className="absolute inset-0 will-change-transform" style={SCROLLED}>
      {keys.map(({ key, time, inside }, i) => {
        const next = keys[i + 1];
        const showsSpan = !step && next !== undefined && next.key.value !== key.value;
        return (
          <Fragment key={key.id}>
            {showsSpan && (
              <i
                className="absolute top-[11px] h-0.5 bg-border-strong"
                style={{
                  left: timeToPx(time, pxPerSecond),
                  width: timeToPx(next.time - time, pxPerSecond),
                }}
              />
            )}
            <KeyDiamond
              x={timeToPx(time, pxPerSecond)}
              keyRef={`${clip.id}|${path}|${key.id}`}
              selected={selectedIds.has(`${clip.id}|${path}|${key.id}`)}
              step={step}
              eased={!step && key.ease !== undefined && key.ease.kind !== "linear"}
              outside={!inside}
            />
          </Fragment>
        );
      })}
    </div>
  );
}
