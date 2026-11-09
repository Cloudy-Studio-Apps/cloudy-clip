import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { compositionMixOf, projectRef, type CompositionId } from "@/modules/project";
import { formatTrim, trimAt, trimPosition } from "../../logic/fader";
import { setMaster } from "../../sound.mix.commands";
import { LineSlider } from "../controls";
import { report } from "../report";

/**
 * The master's input trim, -24 to 24 dB on the sum before its fader (what Match target sets), as
 * a thin line with its value beside it: the drag plays live through `previewMix("master", …)` and
 * sends one `sound.setMaster { trimDb }` on release; a double-click returns it to 0.
 */
export function MasterTrim({ compositionId }: { compositionId: CompositionId | undefined }) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const read = () => {
    const composition = compositionId && project.getState().compositions[compositionId];
    return composition ? (compositionMixOf(composition).master.trimDb ?? 0) : 0;
  };
  const value = useStore(project.api, () => read());

  return (
    <div className="flex items-center gap-1">
      <LineSlider
        value={value}
        label="Master trim"
        toPosition={trimPosition}
        fromPosition={trimAt}
        rest={0}
        format={formatTrim}
        centred
        onInput={(trimDb) =>
          preview.sound.previewMix("master", trimDb === null ? null : { trimDb })
        }
        onCommit={async (trimDb) =>
          report(await bus.run(setMaster, { ...(compositionId && { compositionId }), trimDb }))
        }
        read={read}
        className="min-w-0 flex-1"
      />
      <span className="w-10 shrink-0 text-right font-mono text-2xs text-subtle-foreground">
        {formatTrim(value)}
      </span>
    </div>
  );
}
