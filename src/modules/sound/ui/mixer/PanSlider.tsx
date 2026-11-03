import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef, trackMixOf, type Track } from "@/modules/project";
import { formatPan, panAt, panPosition } from "../../logic/fader";
import { setTrackMix } from "../../sound.mix.commands";
import { LineSlider } from "../controls";

/**
 * A track's pan, −1 (left) to 1 (right): the drag plays live through `previewMix` and sends one
 * `sound.setTrackMix` on release; a double-click centres it.
 */
export function PanSlider({ track }: { track: Track }) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const read = () => {
    const current = project.getState().tracks[track.id];
    return current ? trackMixOf(current).pan : 0;
  };

  return (
    <LineSlider
      value={trackMixOf(track).pan}
      label={`${track.name} pan`}
      toPosition={panPosition}
      fromPosition={panAt}
      rest={0}
      format={formatPan}
      centred
      onInput={(pan) => preview.sound.previewMix(track.id, pan === null ? null : { pan })}
      onCommit={async (pan) => void (await bus.run(setTrackMix, { trackId: track.id, pan }))}
      read={read}
    />
  );
}
