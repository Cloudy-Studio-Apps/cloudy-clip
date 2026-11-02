import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { elementRef } from "@/modules/element";
import { projectRef } from "@/modules/project";
import { setTrackMuted } from "@/modules/timeline";
import { InfoList, ToggleRow } from "@/ui";
import type { InspectorContext, InspectorMember } from "../inspector.types";

/** The member of a clip that carries sound, when one does. */
export function soundMember(context: InspectorContext): InspectorMember | undefined {
  if (context.track.kind === "audio") return context;
  return context.partner?.track.kind === "audio" ? context.partner : undefined;
}

/** Where a clip's sound is: its track, muting that track, and what it's linked to. */
export function SoundSection({ context }: { context: InspectorContext }) {
  const { bus } = useKernel();
  const project = useModule(projectRef).store;
  const elements = useModule(elementRef);
  const sound = soundMember(context);
  const trackId = sound?.track.id;
  const muted = useStore(project.api, (s) =>
    trackId === undefined ? false : s.tracks[trackId]?.muted === true,
  );
  if (!sound) return null;
  const other = sound === context ? context.partner : context;
  const linked =
    other &&
    elements
      .get(other.clip.kind)
      ?.definition.display(other.clip, { project: project.getState(), track: other.track }).label;
  return (
    <>
      <InfoList
        rows={[
          { label: "Track", value: sound.track.name },
          ...(linked ? [{ label: "Linked to", value: linked }] : []),
        ]}
      />
      <ToggleRow
        label="Mute track"
        checked={muted}
        onChange={(next) => void bus.run(setTrackMuted, { trackId: sound.track.id, muted: next })}
      />
    </>
  );
}
