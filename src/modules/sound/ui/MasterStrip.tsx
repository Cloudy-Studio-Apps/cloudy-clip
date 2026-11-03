import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { compositionMixOf, projectRef, type CompositionId } from "@/modules/project";
import { setMaster } from "../sound.mix.commands";
import { Fader } from "./Fader";
import { Meter } from "./Meter";

/** The master of the open composition, pinned at the mixer's right edge: its fader and meters. */
export function MasterStrip({ compositionId }: { compositionId: CompositionId | undefined }) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const read = () => {
    const composition = compositionId && project.getState().compositions[compositionId];
    return composition ? compositionMixOf(composition).master.volumeDb : 0;
  };
  const volumeDb = useStore(project.api, () => read());

  return (
    <div className="flex w-28 shrink-0 flex-col gap-1.5 border-l-[1.5px] border-subtle-foreground bg-muted p-2">
      <div className="truncate text-center font-hand text-base font-bold leading-tight">Master</div>
      <div className="-mt-1 text-center font-mono text-sm font-bold text-subtle-foreground">
        OUT
      </div>
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
    </div>
  );
}
