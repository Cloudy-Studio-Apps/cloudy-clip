import { useRef } from "react";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef, trackMixOf, type TrackId } from "@/modules/project";
import { setTrackMix } from "../../sound.mix.commands";
import { soundRef } from "../../sound.ref";

/**
 * A track's fader with automation: a press while playing in Touch or Latch writes the volume line
 * (`AutomationWriter`) and its release changes nothing else; any other drag sets the fader's
 * volume, one `sound.setTrackMix` on release. Read gives the level a pass holds (Latch after the
 * release), else the saved one. The props go straight onto `Fader`.
 */
export function useAutomationFader(trackId: TrackId) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const { automation } = useModule(soundRef);
  // This press writes the line: its moves, release and commit go to the writer.
  const writing = useRef(false);

  const saved = () => {
    const track = project.getState().tracks[trackId];
    return track ? trackMixOf(track).volumeDb : 0;
  };
  const read = () => automation.level(trackId) ?? saved();

  return {
    read,
    onPress() {
      writing.current = automation.press(trackId, read());
    },
    onRelease() {
      if (writing.current) automation.release(trackId);
    },
    onInput(db: number | null) {
      if (!writing.current) {
        preview.sound.previewMix(trackId, db === null ? null : { volumeDb: db });
      } else if (db === null) {
        // The end of a writing press: the writer lets the live level go once its pass is sent.
        writing.current = false;
      } else {
        automation.move(trackId, db);
      }
    },
    async onCommit(volumeDb: number) {
      if (writing.current) return;
      await bus.run(setTrackMix, { trackId, volumeDb });
    },
  };
}
