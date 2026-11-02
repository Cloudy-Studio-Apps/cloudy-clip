import { RotateCcw } from "lucide-react";
import { InspectorSection, type InspectorContext } from "@/modules/inspector";
import { IconButton } from "@/ui";
import { useSpeedEdit } from "./speed.edit.hook";
import { SpeedFields } from "./SpeedFields";

/** The Speed section under Transform, for a clip that plays a file. */
export function SpeedSection({ context }: { context: InspectorContext }) {
  const { clip } = context;
  const { reset } = useSpeedEdit(clip.id);
  return (
    <InspectorSection
      title="Speed"
      actions={
        <IconButton
          label="Reset speed"
          disabled={clip.speed === undefined}
          className="!size-[18px] [&_svg]:!size-3"
          onClick={() => void reset()}
        >
          <RotateCcw />
        </IconButton>
      }
    >
      <SpeedFields clipId={clip.id} />
    </InspectorSection>
  );
}
