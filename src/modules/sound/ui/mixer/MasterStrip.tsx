import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { compositionMixOf, projectRef, type CompositionId } from "@/modules/project";
import { cn, LetterToggle } from "@/ui";
import { chainOf } from "../../logic/effects";
import { setMaster } from "../../sound.mix.commands";
import { soundRef } from "../../sound.ref";
import { EffectChain } from "../effects";
import { LineFader } from "./LineFader";
import { MasterPan } from "./MasterPan";
import { Meter } from "./Meter";
import { ReadButton } from "./ReadButton";
import { SendsTo } from "./SendsTo";
import { StripLabel } from "./StripLabel";

/**
 * The master of the open composition, pinned at the mixer's right edge, in a strip's order: its
 * effects (after the fader), where it goes (`Output 1-2`, the stereo out, the only one), pan,
 * fader and meters, M and Read. The fader is a track's (`LineFader`: Read, Touch and Latch write
 * the master's volume line); M is `sound.setMaster { muted }`. A click marks it and shows its
 * chain in the Channel tab.
 */
export function MasterStrip({ compositionId }: { compositionId: CompositionId | undefined }) {
  const { bus } = useKernel();
  const sound = useModule(soundRef);
  const selected = useStore(sound.view, (s) => s.selected === "master");
  const project = useModule(projectRef).store;
  const muted = useStore(project.api, (s) => {
    const composition = compositionId && s.compositions[compositionId];
    return composition ? compositionMixOf(composition).master.muted === true : false;
  });
  const effects = useStore(project.api, (s) => chainOf(s, "master", compositionId));

  return (
    <div
      className={cn(
        "flex w-28 shrink-0 cursor-pointer flex-col gap-1.5 border-l-[1.5px] border-subtle-foreground bg-muted p-2",
        selected && "shadow-[inset_0_2px_0_var(--mark)]",
      )}
      onClick={() => sound.select("master")}
    >
      <div className="truncate text-center font-hand text-base font-bold leading-tight">Master</div>
      <div className="-mt-1 text-center font-mono text-sm font-bold text-subtle-foreground">
        OUT
      </div>
      <StripLabel>Effects</StripLabel>
      <EffectChain target="master" compositionId={compositionId} effects={effects} />
      <SendsTo to="Output 1-2" />
      <StripLabel>Pan</StripLabel>
      <MasterPan compositionId={compositionId} />
      <LineFader target="master" compositionId={compositionId} label="Master level">
        <Meter target="master" side="left" />
        <Meter target="master" side="right" />
      </LineFader>
      <div className="flex justify-center gap-0.5">
        <LetterToggle
          on={muted}
          label={muted ? "Unmute master" : "Mute master"}
          tone="mark"
          onToggle={() =>
            void bus.run(setMaster, { ...(compositionId && { compositionId }), muted: !muted })
          }
        >
          M
        </LetterToggle>
        <ReadButton target="master" />
      </div>
    </div>
  );
}
