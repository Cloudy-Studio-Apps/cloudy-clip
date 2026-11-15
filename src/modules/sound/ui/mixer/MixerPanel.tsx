import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import {
  projectRef,
  useOpenComposition,
  type MixBus,
  type Track,
  type TrackId,
} from "@/modules/project";
import { cn, EmptyState } from "@/ui";
import { soundRef } from "../../sound.ref";
import { MasterStrip } from "./MasterStrip";
import { MixerBar } from "./MixerBar";
import { MixerStrip } from "./MixerStrip";

const NO_TRACKS: readonly TrackId[] = [];
const NO_GROUPS: readonly MixBus[] = [];

/**
 * The mixer: its bar (`MixerBar`), a strip per audio track of the open composition in
 * `trackOrder`, then a strip per group, scrolling sideways together, and Master pinned at the
 * right edge. The bar's filter shows one group and the tracks sent to it. Expand all lets it take
 * the page. Its meters register with the page's one meter loop (`SoundPage` runs it).
 */
export function MixerPanel() {
  const sound = useModule(soundRef);
  const open = useOpenComposition();
  const trackOrder = open?.trackOrder ?? NO_TRACKS;
  const tracksById = useStore(useModule(projectRef).store.api, (s) => s.tracks);
  const selected = useStore(sound.view, (s) => s.selected);
  const expanded = useStore(sound.view, (s) => s.expanded);
  const filter = useStore(sound.view, (s) => s.filter);
  const groups = open?.mix?.buses ?? NO_GROUPS;
  const tracks = useMemo(
    () =>
      trackOrder.flatMap((id): Track[] => {
        const track = tracksById[id];
        return track?.kind === "audio" ? [track] : [];
      }),
    [trackOrder, tracksById],
  );
  // A filter whose group has gone shows every strip.
  const only = groups.some((group) => group.id === filter) ? filter : null;
  const shownTracks = only === null ? tracks : tracks.filter((t) => t.mix?.busId === only);
  const shownGroups = only === null ? groups : groups.filter((group) => group.id === only);

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col border-l border-border-strong bg-surface",
        expanded ? "flex-1 border-l-0" : "w-[46vw] max-w-[860px] shrink-0",
      )}
    >
      <MixerBar strips={shownTracks.length + shownGroups.length + 1} groups={groups} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          {tracks.length === 0 ? (
            <EmptyState title="No audio tracks" className="m-3">
              Add one with Audio track on the timeline, or place a video with sound on the Edit
              page.
            </EmptyState>
          ) : (
            <>
              {shownTracks.map((track) => (
                <MixerStrip
                  key={track.id}
                  track={track}
                  code={`A${tracks.indexOf(track) + 1}`}
                  selected={track.id === selected}
                />
              ))}
              {open &&
                shownGroups.map((group) => (
                  <MixerStrip
                    key={group.id}
                    group={group}
                    compositionId={open.id}
                    code={`G${groups.indexOf(group) + 1}`}
                    selected={group.id === selected}
                  />
                ))}
            </>
          )}
        </div>
        <MasterStrip compositionId={open?.id} />
      </div>
    </section>
  );
}
