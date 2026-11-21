import { useRef } from "react";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef, type CompositionId } from "@/modules/project";
import { lineFader } from "../../logic/automation";
import { setMaster, setTrackMix } from "../../sound.mix.commands";
import { soundRef } from "../../sound.ref";
import type { LineTarget } from "../../sound.line.types";
import { report } from "@/core";

/**
 * The fader of a track, or of the master of `compositionId`, with automation: a press while
 * playing in Touch or Latch writes the volume line (`AutomationWriter`) and its release changes
 * nothing else; any other drag sets the fader's volume, one `sound.setTrackMix` (or
 * `sound.setMaster`) on release. Read gives the level a pass holds (Latch after the release), else
 * the saved one. The props go straight onto `Fader`.
 */
export function useAutomationFader(target: LineTarget, compositionId?: CompositionId) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const { automation } = useModule(soundRef);
  // This press writes the line: its moves, release and commit go to the writer.
  const writing = useRef(false);

  const saved = () => lineFader(project.getState(), target, compositionId ?? null)?.volumeDb ?? 0;
  const read = () => automation.level(target) ?? saved();

  return {
    read,
    onPress() {
      writing.current = automation.press(target, read());
    },
    onRelease() {
      if (writing.current) automation.release(target);
    },
    onInput(db: number | null) {
      if (!writing.current) {
        preview.sound.previewMix(target, db === null ? null : { volumeDb: db });
      } else if (db === null) {
        // The end of a writing press: the writer lets the live level go once its pass is sent.
        writing.current = false;
      } else {
        automation.move(target, db);
      }
    },
    async onCommit(volumeDb: number) {
      if (writing.current) return;
      if (target === "master") {
        report(await bus.run(setMaster, { ...(compositionId && { compositionId }), volumeDb }));
      } else {
        report(await bus.run(setTrackMix, { trackId: target, volumeDb }));
      }
    },
  };
}
