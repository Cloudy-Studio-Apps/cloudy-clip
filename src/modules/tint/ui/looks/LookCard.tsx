import { X } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/ui";
import type { Clip, ClipGrade } from "@/modules/project";
import type { LookDef } from "../../tint.types";
import type { GradeSubject } from "../ui.types";
import { useLookThumb } from "./look.thumb.hook";

interface LookCardProps {
  name: string;
  /** What the card says under the name. */
  note: string;
  /** The clip being graded: the picture is its frame with `grade` added to the one edited. */
  clip: Clip | undefined;
  /** The grade being edited (the clip's, its group's or the timeline's). */
  subject: GradeSubject | null;
  grade: LookDef | ClipGrade | undefined;
  /** A picture to show until (or instead of) the clip's own. */
  fallback?: string;
  chosen: boolean;
  onChoose(): void;
  /** Present for a still: removes it. */
  onRemove?(): void;
}

/** A look or still: the current frame through it, its name, and where it came from. */
export function LookCard({
  name,
  note,
  clip,
  subject,
  grade,
  fallback,
  chosen,
  onChoose,
  onRemove,
}: LookCardProps) {
  const card = useRef<HTMLDivElement>(null);
  const picture = useLookThumb(card, clip, grade, subject) ?? fallback;
  return (
    <div ref={card} className="relative">
      <button
        type="button"
        title={`Choose ${name}`}
        aria-pressed={chosen}
        onClick={onChoose}
        className="flex w-full cursor-pointer flex-col gap-1 text-left font-hand text-sm font-bold text-muted-foreground"
      >
        <span
          className={cn(
            "block aspect-video w-full overflow-hidden rounded-sm bg-stage",
            chosen ? "shadow-[0_0_0_1.5px_var(--mark)]" : "shadow-[0_0_0_1px_var(--border)]",
          )}
        >
          {picture && (
            <img src={picture} alt="" draggable={false} className="size-full object-cover" />
          )}
        </span>
        {name}
        <span className="font-mono text-2xs font-normal text-subtle-foreground">{note}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          title={`Remove ${name}`}
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="absolute top-1 right-1 flex size-4 cursor-pointer items-center justify-center rounded-xs bg-surface text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
