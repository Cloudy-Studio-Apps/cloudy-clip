import { useState } from "react";
import { ClipTabSections } from "@/modules/inspector";
import { cn, EmptyState, SegmentedControl, type SegmentedOption } from "@/ui";
import type { SoundPanelTab } from "../sound.types";
import { ChannelTab } from "./ChannelTab";
import { LoudnessTab } from "./LoudnessTab";

const TABS: readonly SegmentedOption<SoundPanelTab>[] = [
  { value: "clip", label: "Clip" },
  { value: "channel", label: "Channel" },
  { value: "loudness", label: "Loudness" },
];

/**
 * The panel under the Sound page's timeline. Clip: the inspector's Audio sections of the selected
 * clip. Channel: the effects of the marked strip. Loudness: the live reading. All stay mounted, so
 * the loudness history goes on behind the others.
 */
export function SoundPanel() {
  const [tab, setTab] = useState<SoundPanelTab>("clip");
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <div className="flex h-9 shrink-0 items-end border-b border-border-strong px-3">
        <SegmentedControl<SoundPanelTab>
          label="Panel"
          options={TABS}
          value={tab}
          onChange={setTab}
        />
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto", tab !== "clip" && "hidden")}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] content-start">
          <ClipTabSections
            tab="audio"
            noClip={
              <EmptyState title="Select one clip" className="col-span-full m-3">
                Its volume, fades, pitch and EQ show here.
              </EmptyState>
            }
            noSections={
              <EmptyState title="This clip has no sound" className="col-span-full m-3">
                Select a clip on an audio track to change how it sounds.
              </EmptyState>
            }
          />
        </div>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto", tab !== "channel" && "hidden")}>
        <ChannelTab />
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto", tab !== "loudness" && "hidden")}>
        <LoudnessTab shown={tab === "loudness"} />
      </div>
    </div>
  );
}
