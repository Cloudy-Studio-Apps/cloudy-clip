import { AudioLines } from "lucide-react";

interface ExportStageProps {
  picture: string | null;
  /** False for a sound-only export. */
  hasPicture: boolean;
  /** How soft the picture is shown: a hint at the quality, not the real encode. */
  blur: number;
}

/** The composition, as big as the room allows. */
export function ExportStage({ picture, hasPicture, blur }: ExportStageProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      {!hasPicture ? (
        <AudioLines className="size-24 text-primary" />
      ) : picture ? (
        <img
          src={picture}
          alt="The composition"
          style={{ filter: blur > 0 ? `blur(${blur}px)` : undefined }}
          className="max-h-full max-w-full rounded-xs object-contain shadow-soft"
        />
      ) : null}
    </div>
  );
}
