import { RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { useKernel } from "@/core";
import { KeyAction } from "@/modules/keyframe";
import { IconButton } from "@/ui";
import { changedKeyPaths, toolKeyPaths } from "../logic/keyable";
import { PAGE_RESET } from "../logic/tools";
import { resetGrade } from "../tint.commands";
import { TINT_LAYOUT } from "../tint.layout";
import type { ToolId } from "../tint.types";
import { useCurrentEntry } from "./current.hook";
import { useEditTarget } from "./edit.target.hook";
import { HeaderGap } from "./HeaderGap";
import { PanelNote } from "./PanelNote";
import { settle } from "./settle";
import { useTintView } from "./view.hook";

const GROUP_NAMES = { parallel: "side by side", layer: "stacked", channels: "per channel" };

/**
 * Names the open tool and the layer it edits, with the key diamond (a clip's own correction only:
 * the tool's numbers changed from neutral or already keyed, keyed together at the playhead with
 * `keyframe.setMany`; disabled with a tip when none is) and reset (of every layer in a
 * selected group).
 */
export function ToolHeader({ id, name }: { id: ToolId; name: string }) {
  const { bus } = useKernel();
  const leader = useTintView((v) => v.mode === "leader");
  const { subject, nodeId, title, group, values } = useEditTarget();
  const animation = useCurrentEntry()?.clip.animation;
  const page = PAGE_RESET[id];
  // A selected group's reset covers every correction inside it.
  const resetId = group?.id ?? nodeId;
  const on = group ? `the ${GROUP_NAMES[group.kind]} group` : title;
  const keyed = subject?.level === "clip" && nodeId && !group ? nodeId : null;
  const { paths, idle } = useMemo(() => {
    if (!keyed) return { paths: [], idle: false };
    const full = (sub: string) => `grade.nodes.${keyed}.values.${sub}`;
    const changed = changedKeyPaths(id, values, (sub) => animation?.[full(sub)] !== undefined);
    // Nothing changed: the whole tool's paths, so a disabled diamond still shows where keys go.
    const idle = changed.length === 0;
    return { paths: (idle ? toolKeyPaths(id) : changed).map(full), idle };
  }, [id, keyed, values, animation]);
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
        <span title={idle ? "Change a value to key it" : undefined}>
          <KeyAction clip={{ id: subject.clipId, kind: "clip" }} paths={paths} disabled={idle} />
        </span>
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
