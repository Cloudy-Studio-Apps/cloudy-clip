import { ClipboardPaste, Copy, CopyCheck, FolderPlus, WandSparkles } from "lucide-react";
import type { MouseEvent } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { gradeOf, useOpenComposition } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { EmptyState, IconButton } from "@/ui";
import { copyGrade, pasteGrade } from "../tint.clipboard.commands";
import { pinClip } from "../tint.view.commands";
import { ClipCard } from "./ClipCard";
import { useCurrentClip } from "./current.hook";
import { useStrip } from "./strip.hook";
import { HeaderGap } from "./HeaderGap";
import { HeaderRule } from "./HeaderRule";
import { LevelSwitch } from "./LevelSwitch";
import { settle } from "./settle";
import { PanelNote } from "./PanelNote";
import { PastePartMenu } from "./PastePartMenu";
import { TimelineOverview } from "./TimelineOverview";
import { TintPanel } from "./TintPanel";
import { VersionMenu } from "./VersionMenu";

const nothing = () => {};

/** The clips bar: picture clips of every video track in time order, and how grades move between them. */
export function ClipStrip() {
  const { bus } = useKernel();
  const timeline = useModule(timelineRef);
  const strip = useStrip();
  const current = useCurrentClip();
  const selection = useStore(timeline.view, (s) => s.selection);
  const name = useOpenComposition()?.name ?? "";
  const graded = strip.filter((entry) => gradeOf(entry.clip) !== null).length;
  const all = strip.map((entry) => entry.clip.id);
  // Paste goes to the selected clips of the strip, else the one being graded.
  const picked = all.filter((id) => selection.includes(id));
  const targets = picked.length > 0 ? picked : current ? [current] : [];
  const paste = (clipIds: string[]) => void settle(bus.run(pasteGrade, { clipIds }));
  // Ctrl or Shift selects (shared with Edit); a plain click grades the clip and goes there.
  const pick = (id: string, event: MouseEvent) =>
    event.ctrlKey || event.metaKey || event.shiftKey
      ? timeline.selectClip(id, true)
      : void bus.run(pinClip, { clipId: id });
  return (
    <TintPanel
      header={
        <>
          Clips
          <PanelNote>
            {strip.length} in {name} · {graded} graded
          </PanelNote>
          <HeaderGap />
          <LevelSwitch />
          <VersionMenu />
          <HeaderRule />
          <IconButton
            label="Copy grade"
            disabled={!current}
            onClick={() =>
              current && void settle(bus.run(copyGrade, { target: { clipId: current } }))
            }
          >
            <Copy />
          </IconButton>
          <IconButton
            label="Paste grade onto the selected clips"
            disabled={targets.length === 0}
            onClick={() => paste(targets)}
          >
            <ClipboardPaste />
          </IconButton>
          <PastePartMenu clipIds={targets} />
          <IconButton
            label="Paste to all: onto every clip in the strip"
            disabled={all.length === 0}
            onClick={() => paste(all)}
          >
            <CopyCheck />
          </IconButton>
          <IconButton
            label="Match all to this: every selected clip takes this clip's colors"
            onClick={nothing}
          >
            <WandSparkles />
          </IconButton>
          <IconButton label="Make shot group: the selected clips share one grade" onClick={nothing}>
            <FolderPlus />
          </IconButton>
        </>
      }
    >
      <div className="flex min-h-0 flex-1 gap-2.5 overflow-x-auto overflow-y-hidden px-3 pt-2.5 pb-1">
        {strip.length === 0 && (
          <EmptyState title="No picture clips yet" className="border-0">
            Put a video or a picture on the timeline to grade it here.
          </EmptyState>
        )}
        {strip.map((entry) => (
          <ClipCard
            key={entry.clip.id}
            entry={entry}
            current={entry.clip.id === current}
            selected={selection.includes(entry.clip.id)}
            onPick={(event) => pick(entry.clip.id, event)}
          />
        ))}
      </div>
      <TimelineOverview strip={strip} />
    </TintPanel>
  );
}
