import { RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { useKernel } from "@/core";
import { KeyAction } from "@/modules/keyframe";
import { IconButton } from "@/ui";
import { toolKeyPaths } from "../logic/keyable";
import { PAGE_RESET } from "../logic/tools";
import { resetGrade } from "../tint.commands";
import { TINT_LAYOUT } from "../tint.layout";
import type { ToolId } from "../tint.types";
import { useEditTarget } from "./edit.target.hook";
import { HeaderGap } from "./HeaderGap";
import { PanelNote } from "./PanelNote";
import { settle } from "./settle";
import { useTintView } from "./view.hook";

const GROUP_NAMES = { parallel: "side by side", layer: "stacked", channels: "per channel" };

/**
 * Names the open tool and the layer it edits, with the key diamond (a clip's own correction only:
 * every keyable number of the tool, keyed together at the playhead) and reset (of every layer in a
 * selected group).
 */
export function ToolHeader({ id, name }: { id: ToolId; name: string }) {
  const { bus } = useKernel();
  const leader = useTintView((v) => v.mode === "leader");
  const { subject, nodeId, title, group } = useEditTarget();
  const page = PAGE_RESET[id];
  // A selected group's reset covers every correction inside it.
  const resetId = group?.id ?? nodeId;
  const on = group ? `the ${GROUP_NAMES[group.kind]} group` : title;
  const keyed = subject?.level === "clip" && nodeId && !group ? nodeId : null;
  const paths = useMemo(
    () => (keyed ? toolKeyPaths(id).map((sub) => `grade.nodes.${keyed}.values.${sub}`) : []),
    [id, keyed],
  );
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
      {subject && paths.length > 0 && (
        <KeyAction clip={{ id: subject.clipId, kind: "clip" }} paths={paths} />
      )}
      <IconButton
        label={`Reset ${name}${id === "wheels" ? " (every mode)" : ""}${on ? ` on ${on}` : ""}: back to neutral, the ${group ? "layers stay" : "layer stays"}`}
        disabled={!subject || !resetId || !page}
        onClick={() => {
          if (subject && resetId && page) {
            void settle(bus.run(resetGrade, { target: subject.target, nodeId: resetId, ...page }));
          }
        }}
      >
        <RotateCcw />
      </IconButton>
    </header>
  );
}
