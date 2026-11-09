import type { ReactNode } from "react";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef, type CompositionId, type MixBus } from "@/modules/project";
import { setBus } from "../../sound.bus.commands";
import { Fader } from "./Fader";

interface GroupFaderProps {
  group: MixBus;
  compositionId: CompositionId;
  children: ReactNode;
}

/** A group's fader: it plays live through `previewMix` and sends one `sound.setBus` on release. No line. */
export function GroupFader({ group, compositionId, children }: GroupFaderProps) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const read = () =>
    project.getState().compositions[compositionId]?.mix?.buses?.find((b) => b.id === group.id)
      ?.volumeDb ?? 0;
  return (
    <Fader
      value={group.volumeDb}
      label={`${group.name} level`}
      read={read}
      onInput={(db) => preview.sound.previewMix(group.id, db === null ? null : { volumeDb: db })}
      onCommit={async (volumeDb) =>
        void (await bus.run(setBus, { compositionId, busId: group.id, patch: { volumeDb } }))
      }
    >
      {children}
    </Fader>
  );
}
