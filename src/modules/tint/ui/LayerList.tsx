import { useMemo, useRef } from "react";
import { useModule } from "@/core";
import { gradeOf } from "@/modules/project";
import { numberOf, toStack } from "../logic/stack";
import { layerIds } from "../logic/layers";
import { tintRef } from "../tint.ref";
import { AddMenu } from "./AddMenu";
import { useCurrentEntry } from "./current.hook";
import { FlowLabel } from "./FlowLabel";
import { LayersContext } from "./layers.context";
import { useLayerActions } from "./layers.actions.hook";
import { startLayerDrag } from "./layer.drag.gesture";
import { StackItems } from "./StackItems";
import { useNodeThumbs } from "./thumbs.hook";
import type { LayersEnv } from "./ui.types";

const INPUT_NAMES = {
  rec709: "Rec.709",
  srgb: "sRGB",
  slog3: "S-Log3",
  appleLog: "Apple Log",
  clog2: "C-Log2",
  clog3: "C-Log3",
  vlog: "V-Log",
  flog: "F-Log",
} as const;

/** Baby Seal: the current clip's grade as layers, top (nearest the picture coming in) to bottom. */
export function LayerList() {
  const entry = useCurrentEntry();
  if (!entry) {
    return (
      <div className="px-3 py-4 text-sm text-muted-foreground">
        Pick a clip with a picture to grade it.
      </div>
    );
  }
  return <Layers key={entry.clip.id} clipId={entry.clip.id} grade={gradeOf(entry.clip)} />;
}

function Layers({ clipId, grade }: { clipId: string; grade: ReturnType<typeof gradeOf> }) {
  const tint = useModule(tintRef);
  const actions = useLayerActions(clipId);
  const stack = useMemo(() => toStack(grade), [grade]);
  const numbers = useMemo(() => numberOf(grade), [grade]);
  const ids = useMemo(() => layerIds(stack), [stack]);
  const thumbs = useNodeThumbs(clipId, grade, ids);
  const list = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const shown = grade ?? { nodes: {}, out: { node: "source" as const } };
  const env = useMemo<LayersEnv>(
    () => ({
      clipId,
      grade: shown,
      numbers,
      thumbs,
      actions,
      drag(event, id) {
        if (!list.current || !line.current) return;
        startLayerDrag({
          event,
          id,
          list: list.current,
          line: line.current,
          onDrop: (nodeId, to) => actions.move(nodeId, to),
        });
      },
    }),
    // `shown` follows `grade`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clipId, grade, numbers, thumbs, actions],
  );
  const space = INPUT_NAMES[grade?.input ?? "rec709"];
  return (
    <LayersContext.Provider value={env}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={list}
          className="relative flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto px-3 py-2.5"
        >
          <FlowLabel>Picture in · {space}</FlowLabel>
          {stack.length === 0 ? (
            <p className="px-1 py-3 text-sm text-muted-foreground">
              No corrections yet. Add one to start grading this clip.
            </p>
          ) : (
            <StackItems items={stack} />
          )}
          <FlowLabel>Out to the timeline</FlowLabel>
          <div
            ref={line}
            className="pointer-events-none absolute right-3 left-3 hidden h-0.5 bg-mark"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2.5">
          <AddMenu
            onCorrection={() => {
              const selected = tint.view.getState().selected;
              void actions.add(
                selected && shown.nodes[selected]?.kind === "correct" ? selected : undefined,
              );
            }}
          />
        </div>
      </div>
    </LayersContext.Provider>
  );
}
