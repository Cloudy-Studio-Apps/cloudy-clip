import { RotateCcw } from "lucide-react";
import { useKernel } from "@/core";
import { IconButton } from "@/ui";
import { PAGE_RESET } from "../logic/tools";
import { resetGrade } from "../tint.commands";
import { TINT_LAYOUT } from "../tint.layout";
import type { ToolId } from "../tint.types";
import { useEditTarget } from "./edit.target.hook";
import { HeaderGap } from "./HeaderGap";
import { PanelNote } from "./PanelNote";
import { settle } from "./settle";
import { useTintView } from "./view.hook";

/** Names the open tool and the layer it edits, with reset. */
export function ToolHeader({ id, name }: { id: ToolId; name: string }) {
  const { bus } = useKernel();
  const leader = useTintView((v) => v.mode === "leader");
  const { clipId, nodeId, title } = useEditTarget();
  const page = PAGE_RESET[id];
  return (
    <header
      style={{ height: TINT_LAYOUT.headerHeight }}
      className="flex shrink-0 items-center gap-1 border-b border-border pr-2 pl-[18px] font-hand text-md font-bold"
    >
      {name}
      <HeaderGap />
      {title && (
        <PanelNote>
          {leader ? "Node" : "Layer"} {title}
        </PanelNote>
      )}
      <IconButton
        label={`Reset ${name}${id === "wheels" ? " (every mode)" : ""}${title ? ` on ${title}` : ""}: back to neutral, the layer stays`}
        disabled={!clipId || !nodeId || !page}
        onClick={() => {
          if (clipId && nodeId && page) {
            void settle(bus.run(resetGrade, { target: { clipId }, nodeId, ...page }));
          }
        }}
      >
        <RotateCcw />
      </IconButton>
    </header>
  );
}
