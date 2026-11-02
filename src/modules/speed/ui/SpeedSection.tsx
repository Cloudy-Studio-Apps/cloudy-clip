import { ChevronsLeft, ChevronsRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { notify, useModule } from "@/core";
import { InspectorSection, type InspectorContext } from "@/modules/inspector";
import { mediaRef } from "@/modules/media";
import { rampOf, speedOf } from "@/modules/project";
import { IconButton, ProgressBar, SegmentedControl } from "@/ui";
import { useSpeedEdit } from "./speed.edit.hook";
import { SpeedFields } from "./SpeedFields";

const DIRECTIONS = [
  { value: "forward", label: "Forward", icon: ChevronsRight },
  { value: "reverse", label: "Reverse", icon: ChevronsLeft },
];

/** The Speed section under Transform, for a clip that plays a file. */
export function SpeedSection({ context }: { context: InspectorContext }) {
  const { clip } = context;
  const { reset, commit } = useSpeedEdit(clip.id);
  const media = useModule(mediaRef);
  const [making, setMaking] = useState<number | null>(null);
  const { mediaId } = clip;
  const ramped = rampOf(clip) !== undefined;

  const direct = async (next: string) => {
    const reversed = next === "reverse";
    try {
      // The copy comes first, so the preview never waits on a clip already set to reverse.
      if (reversed && mediaId !== undefined) {
        setMaking(0);
        await media.prepareReversed(mediaId, false, setMaking);
      }
      await commit({ reversed });
    } catch (error) {
      notify("error", `This clip can't play backwards: ${String(error)}`);
    } finally {
      setMaking(null);
    }
  };

  return (
    <InspectorSection
      title="Speed"
      actions={
        <IconButton
          label="Reset speed"
          disabled={clip.speed === undefined && !ramped}
          className="!size-[18px] [&_svg]:!size-3"
          onClick={() => void reset()}
        >
          <RotateCcw />
        </IconButton>
      }
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="w-[74px] shrink-0 text-base text-muted-foreground">Direction</span>
        <SegmentedControl
          label="Direction"
          options={DIRECTIONS}
          value={speedOf(clip).reversed ? "reverse" : "forward"}
          disabled={making !== null || ramped}
          onChange={(next) => void direct(next)}
        />
      </div>
      {making !== null && <ProgressBar value={making} />}
      <SpeedFields clipId={clip.id} />
    </InspectorSection>
  );
}
