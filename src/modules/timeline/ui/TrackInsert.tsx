import { Film, Music, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useKernel } from "@/core";
import type { TrackKind } from "@/modules/project";
import { cn } from "@/ui";
import { insertKinds } from "../logic/placement";
import { kindInScope } from "../logic/scope";
import { addTrack } from "../timeline.commands";
import { useHeaderWidth } from "./header.width.hook";
import { useTimelineScope } from "./scope.hook";

function AddButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="flex h-[18px] cursor-pointer items-center gap-0.5 rounded-[3px] border border-border-strong bg-surface px-1 text-muted-foreground hover:border-primary hover:text-foreground [&_svg]:size-3"
      onClick={onClick}
    >
      <Plus aria-hidden />
      {children}
    </button>
  );
}

interface TrackInsertProps {
  /** Where a new track lands in the composition's order. */
  index: number;
  /** The tracks on either side; missing at the edge of the list. */
  above?: TrackKind;
  below?: TrackKind;
}

/** A gap in the track headers. Hovering it offers a new track of the kinds that belong there. */
export function TrackInsert({ index, above, below }: TrackInsertProps) {
  const { bus } = useKernel();
  const headerWidth = useHeaderWidth();
  const scope = useTimelineScope();
  // A sound-scope timeline offers sound tracks only.
  const kinds = insertKinds(above, below).filter((kind) => kindInScope(kind, scope));
  const add = (kind: TrackKind) => void bus.run(addTrack, { kind, index });
  return (
    <div className="sticky left-0 z-[25] h-0" style={{ width: headerWidth }}>
      <div
        className={cn(
          "group absolute inset-x-0 flex h-3 items-center justify-center gap-1",
          above ? "-top-1.5" : "top-0",
        )}
      >
        <span className="absolute inset-x-0 top-1/2 h-px bg-primary opacity-0 group-hover:opacity-100" />
        <div className="relative flex gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          {kinds.includes("video") && (
            <AddButton label="Add video track here" onClick={() => add("video")}>
              <Film aria-hidden />
            </AddButton>
          )}
          {kinds.includes("audio") && (
            <AddButton label="Add audio track here" onClick={() => add("audio")}>
              <Music aria-hidden />
            </AddButton>
          )}
        </div>
      </div>
    </div>
  );
}
