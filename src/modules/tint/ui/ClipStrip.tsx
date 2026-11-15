import { ClipboardPaste, Copy, CopyCheck, FolderPlus, WandSparkles } from "lucide-react";
import type { MouseEvent } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { gradeOf, projectRef, useOpenComposition, type Clip } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { EmptyState, IconButton } from "@/ui";
import { copyGrade, pasteGrade } from "../tint.clipboard.commands";
import { setShotGroup } from "../tint.shot.commands";
import type { GradeTarget } from "../tint.types";
import { pinClip } from "../tint.view.commands";
import { ClipCard } from "./ClipCard";
import { useCurrentClip } from "./current.hook";
import { useStrip } from "./strip.hook";
import { HeaderGap } from "./HeaderGap";
import { HeaderRule } from "./HeaderRule";
import { LevelSwitch } from "./LevelSwitch";
import { useMatch } from "./match.hook";
import { settle } from "./settle";
import { useGradeSubject } from "./subject.hook";
import { PanelNote } from "./PanelNote";
import { PastePartMenu } from "./PastePartMenu";
import { TimelineOverview } from "./TimelineOverview";
import { TintPanel } from "./TintPanel";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";
import { VersionMenu } from "./VersionMenu";

/**
 * The clips bar: picture clips of every video track in time order, and how grades move between
 * them. The graded marks and count follow the level switch (a clip's own grade, its shot group's,
 * or the whole timeline's).
 */
export function ClipStrip() {
  const { bus } = useKernel();
  const timeline = useModule(timelineRef);
  const strip = useStrip();
  const current = useCurrentClip();
  const subject = useGradeSubject();
  const selection = useStore(timeline.view, (s) => s.selection);
  const composition = useOpenComposition();
  const groups = useStore(useModule(projectRef).store.api, (s) => s.gradeGroups);
  const level = useTintView((v) => v.level);
  const set = useTintSet();
  const m = useMatch();
  const gradedAt = (clip: Clip) =>
    level === "clip"
      ? gradeOf(clip) !== null
      : level === "group"
        ? !!groups?.[clip.gradeGroup ?? ""]?.grade
        : !!composition?.grade;
  const graded = strip.filter((entry) => gradedAt(entry.clip)).length;
  const all = strip.map((entry) => entry.clip.id);
  // Selected clips of the strip, else the one being graded.
  const picked = all.filter((id) => selection.includes(id));
  const chosen = picked.length > 0 ? picked : current ? [current] : [];
  // Paste goes to those clips, or to the group's or the timeline's grade at those levels.
  const targets: GradeTarget[] =
    level === "clip" ? chosen.map((clipId) => ({ clipId })) : subject ? [subject.target] : [];
  const paste = (to: GradeTarget[]) => void settle(bus.run(pasteGrade, { targets: to }));
  const makeGroup = async () => {
    const name = `Shot group ${Object.keys(groups ?? {}).length + 1}`;
    const result = await settle(bus.run(setShotGroup, { clipIds: chosen, group: { name } }));
    if (result.ok) set({ level: "group", selected: null });
  };
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
            {strip.length} in {composition?.name ?? ""} · {graded} graded
          </PanelNote>
          <HeaderGap />
          <LevelSwitch />
          <VersionMenu />
          <HeaderRule />
          <IconButton
            label="Copy grade"
            disabled={!subject}
            onClick={() => subject && void settle(bus.run(copyGrade, { target: subject.target }))}
          >
            <Copy />
          </IconButton>
          <IconButton
            label={
              level === "clip"
                ? "Paste grade onto the selected clips"
                : level === "group"
                  ? "Paste grade onto the shot group's grade"
                  : "Paste grade onto the whole timeline's grade"
            }
            disabled={targets.length === 0}
            onClick={() => paste(targets)}
          >
            <ClipboardPaste />
          </IconButton>
          <PastePartMenu targets={targets} />
          <IconButton
            label="Paste to all: onto every clip in the strip"
            disabled={all.length === 0}
            onClick={() => paste(all.map((clipId) => ({ clipId })))}
          >
            <CopyCheck />
          </IconButton>
          <IconButton
            label="Match all to this: every selected clip takes this clip's colors"
            disabled={!m.enabled || m.others.length === 0}
            onClick={() =>
              m.clipId &&
              m.shot(
                m.others.map((entry) => entry.clip.id),
                m.clipId,
              )
            }
          >
            <WandSparkles />
          </IconButton>
          <IconButton
            label="Make shot group: the selected clips share one grade, after each one's own"
            disabled={chosen.length === 0}
            onClick={() => void makeGroup()}
          >
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
            graded={gradedAt(entry.clip)}
            group={groups?.[entry.clip.gradeGroup ?? ""]?.name}
            onPick={(event) => pick(entry.clip.id, event)}
          />
        ))}
      </div>
      <TimelineOverview strip={strip} />
    </TintPanel>
  );
}
