import { PenLine } from "lucide-react";
import { IconButton } from "@/ui";
import { soon } from "../soon";

/** The pen in the timeline's tools: draws volume over clips and tracks (coming in stage 3). */
export function DrawVolumeTool() {
  return (
    <IconButton label="Draw volume" {...soon("lanes.drawVolume")}>
      <PenLine />
    </IconButton>
  );
}
