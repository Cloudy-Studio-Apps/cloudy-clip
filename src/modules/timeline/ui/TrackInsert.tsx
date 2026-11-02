import { Film, Music, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useKernel } from "@/core";
import { cn } from "@/ui";
import { addTrack } from "../timeline.commands";
import { HEADER_WIDTH } from "../timeline.layout";

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
  /** Above the first track: it stays clear of the ruler. */
  first?: boolean;
}

/** A gap in the track headers. Hovering it offers a new video or audio track right there. */
export function TrackInsert({ index, first }: TrackInsertProps) {
  const { bus } = useKernel();
  const add = (kind: "video" | "audio") => void bus.run(addTrack, { kind, index });
  return (
    <div className="sticky left-0 z-[25] h-0" style={{ width: HEADER_WIDTH }}>
      <div
        className={cn(
          "group absolute inset-x-0 flex h-3 items-center justify-center gap-1",
          first ? "top-0" : "-top-1.5",
        )}
      >
        <span className="absolute inset-x-0 top-1/2 h-px bg-primary opacity-0 group-hover:opacity-100" />
        <div className="relative flex gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          <AddButton label="Add video track here" onClick={() => add("video")}>
            <Film aria-hidden />
          </AddButton>
          <AddButton label="Add audio track here" onClick={() => add("audio")}>
            <Music aria-hidden />
          </AddButton>
        </div>
      </div>
    </div>
  );
}
