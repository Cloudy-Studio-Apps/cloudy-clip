import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import { EmptyState } from "@/ui";
import { chainOf } from "../../logic/effects";
import { soundRef } from "../../sound.ref";
import { useEffectEdit } from "../effects";
import { EffectBody } from "../effects";
import { PresetCard } from "./PresetCard";

/**
 * The chain of the marked strip (an audio track of the open composition, or its master): the
 * preset card, then a section per effect in signal order, each with its switch. Drags play live;
 * a release is one command.
 */
export function ChannelTab() {
  const sound = useModule(soundRef);
  const project = useModule(projectRef).store;
  const open = useOpenComposition();
  const selected = useStore(sound.view, (s) => s.selected);
  const track = useStore(project.api, (s) =>
    selected && selected !== "master" ? s.tracks[selected] : undefined,
  );
  const target = selected === "master" || track?.compositionId === open?.id ? selected : null;
  const chain = useStore(project.api, (s) => chainOf(s, target ?? "master", open?.id));
  const edit = useEffectEdit(target ?? "master", open?.id);

  if (!target || !open) {
    return (
      <EmptyState title="Select a strip" className="m-3">
        Click a track&apos;s strip in the mixer, or Master, to see its effects here.
      </EmptyState>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] content-start">
      <PresetCard
        title={track?.name ?? "Master"}
        target={target}
        compositionId={open.id}
        chain={chain}
      />
      {chain.map((effect) => (
        <div key={effect.id} className="min-w-0 border-r border-dashed border-border-strong">
          <EffectBody effect={effect} owner={track} edit={edit} />
        </div>
      ))}
    </div>
  );
}
