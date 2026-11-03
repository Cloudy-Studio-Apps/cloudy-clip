import { ClipboardPaste, Copy, CopyCheck, FolderPlus, WandSparkles } from "lucide-react";
import { IconButton } from "@/ui";
import { ClipCard } from "./ClipCard";
import { DEMO_CLIPS, DEMO_CURRENT } from "./demo/demo.clips";
import { HeaderGap } from "./HeaderGap";
import { HeaderRule } from "./HeaderRule";
import { LevelSwitch } from "./LevelSwitch";
import { PanelNote } from "./PanelNote";
import { PastePartMenu } from "./PastePartMenu";
import { TimelineOverview } from "./TimelineOverview";
import { TintPanel } from "./TintPanel";
import { VersionMenu } from "./VersionMenu";

const nothing = () => {};

/** The clips bar: picture clips of every video track in time order, and how grades move between them. */
export function ClipStrip() {
  const graded = DEMO_CLIPS.filter((clip) => clip.graded).length;
  return (
    <TintPanel
      header={
        <>
          Clips
          <PanelNote>
            {DEMO_CLIPS.length} in Main · {graded} graded
          </PanelNote>
          <HeaderGap />
          <LevelSwitch />
          <VersionMenu />
          <HeaderRule />
          <IconButton label="Copy grade (Ctrl+C)" onClick={nothing}>
            <Copy />
          </IconButton>
          <IconButton label="Paste grade onto the selected clips (Ctrl+V)" onClick={nothing}>
            <ClipboardPaste />
          </IconButton>
          <PastePartMenu />
          <IconButton label="Paste to all: onto every clip in the strip" onClick={nothing}>
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
        {DEMO_CLIPS.map((clip) => (
          <ClipCard key={clip.id} clip={clip} current={clip.id === DEMO_CURRENT} />
        ))}
      </div>
      <TimelineOverview />
    </TintPanel>
  );
}
