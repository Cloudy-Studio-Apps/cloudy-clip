import { Sticker } from "lucide-react";
import { defineElement, prop } from "@/modules/element";
import { stickerSize } from "./logic/size";
import { drawSticker } from "./sticker.draw";
import { checkVariation } from "./sticker.guards";
import type { StickerArtCache, StickerLibrary, StickerProps } from "./sticker.types";

/** The sticker element of one kernel. A clip stores references; the art stays in its pack. */
export function createStickerElement(library: StickerLibrary, art: StickerArtCache) {
  const artOf = (props: StickerProps) => library.artOf(props.pack, props.sticker, props.variation);

  return defineElement({
    kind: "sticker",
    name: "Sticker",
    source: "none",
    tracks: ["video"],
    supports: { transform: true },
    properties: {
      pack: prop.string({ hidden: true }),
      sticker: prop.string({ hidden: true }),
      variation: prop.custom("sticker-variation", {}, { label: "Variation" }),
    },
    defaults: () => ({ pack: "", sticker: "", variation: {} }),
    layout: [{ title: "Variations", layout: "sticker-variation", items: ["variation"] }],
    normalize(next) {
      // Only what can be checked: a clip of a removed plugin stays editable.
      if (library.find(next.pack, next.sticker)) {
        checkVariation(library.axes(next.pack, next.sticker), next.variation);
      }
      return next;
    },
    display(clip) {
      const found = library.find(String(clip.props?.pack), String(clip.props?.sticker));
      return { icon: Sticker, color: "clip-type", label: found?.label ?? "Sticker", body: "none" };
    },
    picture: {
      fit: "none",
      size: (props, { format }) =>
        stickerSize(format, library.find(props.pack, props.sticker)?.aspect ?? 1),
      draw: (ctx, props, env) => drawSticker(ctx, artOf(props), art, env),
      ready(props) {
        if (!library.isLoaded(props.pack)) {
          if (library.hasFailed(props.pack)) return true;
          if (!library.packs().some((pack) => pack.id === props.pack)) return true;
          void library.load(props.pack);
          return false;
        }
        const picked = artOf(props);
        return picked ? art.ready(picked) : true;
      },
    },
  });
}
