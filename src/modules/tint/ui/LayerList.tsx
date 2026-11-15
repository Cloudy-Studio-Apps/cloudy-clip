import { useMemo, useRef } from "react";
import { useModule } from "@/core";
import { numberOf, toStack } from "../logic/stack";
import { groupPick, layerIds } from "../logic/layers";
import { tintRef } from "../tint.ref";
import { AddMenu } from "./AddMenu";
import { FlowLabel } from "./FlowLabel";
import { LayersContext } from "./layers.context";
import { SPACE_NAMES } from "./space.names";
import { useLayerActions } from "./layers.actions.hook";
import { NoSubject } from "./NoSubject";
import { startLayerDrag } from "./layer.drag.gesture";
import { StackItems } from "./StackItems";
import { useNodeThumbs } from "./thumbs.hook";
import { useTintView } from "./view.hook";
import { useGradeSubject } from "./subject.hook";
import type { GradeSubject, LayersEnv } from "./ui.types";

/**
 * Baby Seal: the grade of the current level (the clip's, its shot group's or the whole
 * timeline's) as layers, top (nearest the picture coming in) to bottom.
 */
export function LayerList() {
  const subject = useGradeSubject();
  if (!subject) return <NoSubject />;
  return <Layers key={subject.id} subject={subject} />;
}

/** Where each level's picture comes from, for the flow label. */
const INTO = {
  group: "Picture in · after the clip's own grade",
  timeline: "Frame in · every clip with its grades",
};

function Layers({ subject }: { subject: GradeSubject }) {
  const { grade } = subject;
  const tint = useModule(tintRef);
  const actions = useLayerActions(subject.target);
  const stack = useMemo(() => toStack(grade), [grade]);
  const numbers = useMemo(() => numberOf(grade), [grade]);
  const ids = useMemo(() => layerIds(stack), [stack]);
  const thumbs = useNodeThumbs(subject, grade, ids);
  const selected = useTintView((v) => v.selected);
  const picks = useMemo(
    () => ({
      parallel: groupPick(stack, selected, "parallel"),
      layer: groupPick(stack, selected, "layer"),
      channels: groupPick(stack, selected, "channels"),
    }),
    [stack, selected],
  );
  const list = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const shown = grade ?? { nodes: {}, out: { node: "source" as const } };
  const env = useMemo<LayersEnv>(
    () => ({
      subject,
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
    [subject, grade, numbers, thumbs, actions],
  );
  const space = SPACE_NAMES[grade?.input ?? "rec709"].short;
  return (
    <LayersContext.Provider value={env}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={list}
          className="relative flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto px-3 py-2.5"
        >
          <FlowLabel>
            {subject.level === "clip" ? `Picture in · ${space}` : INTO[subject.level]} → Grading in
            Rec.709 · Output Rec.709 gamma 2.4
          </FlowLabel>
          {stack.length === 0 ? (
            <p className="px-1 py-3 text-sm text-muted-foreground">
              No corrections yet. Add one to start grading{" "}
              {subject.level === "clip"
                ? "this clip"
                : subject.level === "group"
                  ? "every clip of the shot group"
                  : "the whole timeline"}
              .
            </p>
          ) : (
            <StackItems items={stack} />
          )}
          <FlowLabel>
            {subject.level === "clip"
              ? "Out to the shot group and the timeline"
              : subject.level === "group"
                ? "Out to the timeline"
                : "Out to the export"}
          </FlowLabel>
          <div
            ref={line}
            className="pointer-events-none absolute right-3 left-3 hidden h-0.5 bg-mark"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2.5">
          <AddMenu
            onCorrection={() => {
              const at = tint.view.getState().selected;
              void actions.add(
                at && shown.nodes[at]?.kind === "correct" ? { before: at } : undefined,
              );
            }}
            onGroup={(kind) => {
              const ids = picks[kind];
              if (ids) void actions.group(ids, kind);
            }}
            onLook={() => tint.view.setState({ leftTab: "looks" })}
            canGroup={{
              parallel: picks.parallel !== null,
              layer: picks.layer !== null,
              channels: picks.channels !== null,
            }}
          />
        </div>
      </div>
    </LayersContext.Provider>
  );
}
