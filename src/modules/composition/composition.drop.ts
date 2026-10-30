import { LOCAL_ACTOR, notify } from "@/core";
import type { TimelineDrop, TimelineDropHandler } from "@/modules/timeline";
import { createFromMedia, openComposition } from "./composition.commands";
import { placeComposition } from "./composition.place.command";
import type { DropDeps } from "./composition.types";

/**
 * What a drop on a timeline does when no composition can take it: an item with a picture starts
 * one, anything else asks through the dialog, and with compositions around Main opens instead.
 */
export function createCompositionDrop({ bus, project, media, api }: DropDeps) {
  const { store, view } = project;
  let stopWaiting: (() => void) | null = null;

  function cancelWaiting(): void {
    stopWaiting?.();
    stopWaiting = null;
    api.ui.setState({ waiting: null });
  }

  /** Waits outside the bus, which runs one command at a time: this can take a while. */
  function waitForFile(mediaId: string, name: string): void {
    cancelWaiting();
    api.ui.setState({ waiting: name });
    const check = () => {
      const probe = media.getProbe(mediaId);
      if (probe?.status === "error") {
        cancelWaiting();
        notify("error", probe.error ?? `${name} can't be read`);
      } else if (media.pictureMeta(mediaId)) {
        cancelWaiting();
        void bus.run(createFromMedia, { mediaIds: [mediaId] });
      }
    };
    stopWaiting = media.probes.subscribe(check);
    check();
  }

  const handler: TimelineDropHandler = {
    id: "composition.drop",
    handle(drop) {
      const { item } = drop;
      const nothingOpen = view.openFor(LOCAL_ACTOR) === null;
      if (item.type === "composition") {
        const { start, trackId } = drop;
        void (nothingOpen
          ? bus.run(openComposition, { compositionId: item.id })
          : bus.run(placeComposition, { compositionId: item.id, start, trackId }));
        return true;
      }
      if (!nothingOpen) return false;
      const { mainCompositionId, media: files } = store.getState();
      if (mainCompositionId !== null) {
        view.setOpen(LOCAL_ACTOR, mainCompositionId);
        return false;
      }
      const file = item.type === "media" ? files[item.id] : undefined;
      if (file?.kind === "video") waitForFile(file.id, file.name);
      else {
        api.ui.setState({ pendingDrop: drop });
        api.openNew();
      }
      return true;
    },
  };

  /** Takes the drop the dialog was opened for. */
  function dropPending(): TimelineDrop | null {
    const { pendingDrop } = api.ui.getState();
    api.ui.setState({ pendingDrop: null });
    return pendingDrop;
  }

  return { handler, cancelWaiting, dropPending };
}
