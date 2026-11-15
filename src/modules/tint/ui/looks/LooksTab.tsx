import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { useKernel, useModule, usePoint } from "@/core";
import { timelineRef } from "@/modules/timeline";
import { projectRef, type ClipGrade } from "@/modules/project";
import { Button } from "@/ui";
import type { LookDef } from "../../tint.types";
import { applyLook } from "../../tint.color.commands";
import { tintLooks } from "../../tint.points";
import { grabStill, removeStill } from "../../tint.still.commands";
import { useCurrentClip } from "../current.hook";
import { settle } from "../settle";
import { useStrip } from "../strip.hook";
import { LookCard } from "./LookCard";

/** Looks: built-in looks and grabbed stills, chosen with a click and applied to the selected clips. */
export function LooksTab() {
  const { bus } = useKernel();
  const timeline = useModule(timelineRef);
  const clipId = useCurrentClip();
  const strip = useStrip();
  const selection = useStore(timeline.view, (s) => s.selection);
  const { api } = useModule(projectRef).store;
  const stills = useStore(api, (s) => s.stills);
  const order = useStore(api, (s) => s.stillOrder);
  const looks = usePoint(tintLooks);
  const clip = strip.find((entry) => entry.clip.id === clipId)?.clip;
  const cards = useMemo(
    () => [
      ...looks.map((look) => ({
        key: look.id,
        name: look.name,
        note: look.note ?? "look",
        grade: look as LookDef | ClipGrade | undefined,
        image: undefined,
        apply: { lookId: look.id },
        remove: undefined,
      })),
      ...(order ?? []).flatMap((id) => {
        const still = stills?.[id];
        return still
          ? [
              {
                key: id,
                name: still.name,
                note: "your still",
                grade: still.grade,
                image: still.image,
                apply: { stillId: id },
                remove: id,
              },
            ]
          : [];
      }),
    ],
    [looks, stills, order],
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const card = cards.find((c) => c.key === chosen);
  const targets = strip.map((e) => e.clip.id).filter((id) => selection.includes(id));
  const clipIds = targets.length > 0 ? targets : clipId ? [clipId] : [];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(96px,1fr))] content-start gap-2.5 overflow-auto p-3">
        {cards.map((c) => (
          <LookCard
            key={c.key}
            name={c.name}
            note={c.note}
            clip={clip}
            grade={c.grade}
            fallback={c.image}
            chosen={c.key === chosen}
            onChoose={() => setChosen(c.key)}
            onRemove={
              c.remove ? () => void settle(bus.run(removeStill, { stillId: c.remove })) : undefined
            }
          />
        ))}
      </div>
      <div className="flex shrink-0 gap-2 border-t border-border px-3 py-2.5">
        <Button
          size="sm"
          variant="primary"
          disabled={!clipId}
          title="Grab still: save this frame and its grade as a look"
          onClick={() => void settle(bus.run(grabStill, {}))}
        >
          Grab still
        </Button>
        <Button
          size="sm"
          disabled={!card || clipIds.length === 0}
          title="Apply the chosen look to every selected clip (else the clip being graded)"
          onClick={() => card && void settle(bus.run(applyLook, { clipIds, ...card.apply }))}
        >
          Apply to selected
        </Button>
      </div>
    </div>
  );
}
