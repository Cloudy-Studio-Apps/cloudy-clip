import { RotateCcw } from "lucide-react";
import { useKernel } from "@/core";
import { clipTransform, type Clip } from "@/modules/project";
import { setClipTransform } from "@/modules/transform";
import { Button } from "@/ui";
import { InfoList } from "./InfoList";
import { InspectorSection } from "./InspectorSection";

/** Where the clip's picture sits in the frame (changed on the canvas), and a way back to fit. */
export function TransformSection({ clip }: { clip: Clip }) {
  const { bus } = useKernel();
  const t = clipTransform(clip);

  return (
    <InspectorSection title="Transform">
      <InfoList
        rows={[
          { label: "Position", value: `${Math.round(t.x)}, ${Math.round(t.y)} px` },
          { label: "Scale", value: `${Math.round(t.scale * 100)}%` },
          { label: "Rotation", value: `${Math.round(t.rotation)}°` },
        ]}
      />
      <p className="m-0 text-xs text-subtle-foreground">
        Drag the picture in the preview to move it; corners scale, the top handle rotates.
      </p>
      <Button
        size="sm"
        className="self-start"
        disabled={!clip.transform}
        onClick={() => void bus.run(setClipTransform, { clipId: clip.id, reset: true })}
      >
        <RotateCcw />
        Reset
      </Button>
    </InspectorSection>
  );
}
