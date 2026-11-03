import { Volume2 } from "lucide-react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { faderDb, faderPosition } from "../../logic/fader";
import { formatDb } from "../../logic/meter";
import { setMonitor } from "../../sound.monitor.commands";
import { soundRef } from "../../sound.ref";
import { LineSlider } from "../controls";
import { TransportTool } from "./TransportTool";

/** How the user listens: Mono, Dim and the speaker volume. Never in the project or an export. */
export function MonitorControls() {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const { view } = useModule(soundRef);
  const monitor = useStore(view, (s) => s.monitor);
  const read = () => view.getState().monitor.speakerDb;

  return (
    <>
      <TransportTool
        pressed={monitor.mono}
        title="Mono: both sides to both speakers"
        onClick={() => void bus.run(setMonitor, { mono: !monitor.mono })}
      >
        Mono
      </TransportTool>
      <TransportTool
        pressed={monitor.dim}
        title="Dim: 20 dB down"
        onClick={() => void bus.run(setMonitor, { dim: !monitor.dim })}
      >
        Dim
      </TransportTool>
      <span className="ml-1.5 flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <Volume2 aria-hidden className="size-4" />
        <LineSlider
          className="w-16"
          value={monitor.speakerDb}
          label="Speakers"
          toPosition={faderPosition}
          fromPosition={faderDb}
          rest={0}
          format={(db) => `${formatDb(db)} dB`}
          onInput={(speakerDb) =>
            preview.sound.setMonitor(
              speakerDb === null
                ? view.getState().monitor
                : { ...view.getState().monitor, speakerDb },
            )
          }
          onCommit={async (speakerDb) => void (await bus.run(setMonitor, { speakerDb }))}
          read={read}
        />
      </span>
    </>
  );
}
