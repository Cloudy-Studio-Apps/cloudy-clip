import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { compositionMixOf, projectRef, type CompositionId } from "@/modules/project";
import { cn, LetterToggle } from "@/ui";
import { chainOf } from "../../logic/effects";
import { setMaster } from "../../sound.mix.commands";
import { soundRef } from "../../sound.ref";
import { EffectChain } from "../effects";
import { soon } from "../soon";
import { Fader } from "./Fader";
import { MasterPan } from "./MasterPan";
import { Meter } from "./Meter";
import { ReadButton } from "./ReadButton";
import { StripLabel } from "./StripLabel";

/**
 * The master of the open composition, pinned at the mixer's right edge, in a strip's order: its
 * effects (after the fader), where it goes (`Output 1-2`, the stereo out, the only one), pan,
 * fader and meters, M and Read. Pan, M and Read are coming soon (stage 4). A click marks it and
 * shows its chain in the Channel tab.
 */
export function MasterStrip({ compositionId }: { compositionId: CompositionId | undefined }) {
  const { bus } = useKernel();
  const sound = useModule(soundRef);
  const selected = useStore(sound.view, (s) => s.selected === "master");
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const read = () => {
    const composition = compositionId && project.getState().compositions[compositionId];
    return composition ? compositionMixOf(composition).master.volumeDb : 0;
  };
  const volumeDb = useStore(project.api, () => read());
  const effects = useStore(project.api, (s) => chainOf(s, "master", compositionId));
  const mute = soon("master.mute");

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
      <StripLabel>Sends to</StripLabel>
      <div className="truncate border-b border-border-strong font-mono text-sm text-muted-foreground">
        Output 1-2
      </div>
      <StripLabel>Pan</StripLabel>
      <MasterPan />
      <Fader
        value={volumeDb}
        label="Master level"
        onInput={(db) => preview.sound.previewMix("master", db === null ? null : { volumeDb: db })}
        onCommit={async (db) =>
          void (await bus.run(setMaster, { ...(compositionId && { compositionId }), volumeDb: db }))
        }
        read={read}
      >
        <Meter target="master" side="left" />
        <Meter target="master" side="right" />
      </Fader>
      <div className="flex justify-center gap-0.5">
        <LetterToggle on={false} label="Mute master" tone="mark" onToggle={mute.onClick} {...mute}>
          M
        </LetterToggle>
        <ReadButton id="master.read" />
      </div>
    </div>
  );
}
