import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { compositionMixOf, projectRef, type CompositionId } from "@/modules/project";
import { formatPan, panAt, panPosition } from "../../logic/fader";
import { setMaster } from "../../sound.mix.commands";
import { LineSlider } from "../controls";
import { report } from "@/core";

/**
 * The master's pan, a balance of the stereo mix, −1 (left) to 1 (right), drawn as a track's
 * (`PanSlider`): the drag plays live through `previewMix("master", …)` and sends one
 * `sound.setMaster` on release; a double-click centres it.
 */
export function MasterPan({ compositionId }: { compositionId: CompositionId | undefined }) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const read = () => {
    const composition = compositionId && project.getState().compositions[compositionId];
    return composition ? (compositionMixOf(composition).master.pan ?? 0) : 0;
  };
  const value = useStore(project.api, () => read());

  return (
    <LineSlider
      value={value}
      label="Master pan"
      toPosition={panPosition}
      fromPosition={panAt}
      rest={0}
      format={formatPan}
      centred
      onInput={(pan) => preview.sound.previewMix("master", pan === null ? null : { pan })}
      onCommit={async (pan) =>
        report(await bus.run(setMaster, { ...(compositionId && { compositionId }), pan }))
      }
      read={read}
    />
  );
}
