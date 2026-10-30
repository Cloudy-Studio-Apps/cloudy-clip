import { useCallback, useState } from "react";
import { Menu } from "lucide-react";
import { useModule } from "@/core";
import { IconButton } from "@/ui";
import { stickerRef } from "../sticker.ref";
import type { StickerView } from "../sticker.types";
import { StickerDrawer } from "./StickerDrawer";
import { StickerHome } from "./StickerHome";
import { StickerListView } from "./StickerListView";

/**
 * The Stickers tab: recently used and pack covers; the drawer lists topics and installed packs;
 * picking one, or typing in the search box, shows a full grid.
 */
export function StickersPanel() {
  const stickers = useModule(stickerRef);
  const [view, setView] = useState<StickerView>({ kind: "home" });
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const home = () => setView({ kind: "home" });
  const text = search.trim();

  const body = () => {
    if (text) return <StickerListView title="Results" query={{ text }} />;
    if (view.kind === "home") {
      return <StickerHome onOpenPack={(id) => setView({ kind: "pack", id })} />;
    }
    if (view.kind === "all") {
      return <StickerListView title="All stickers" query={{}} onBack={home} />;
    }
    if (view.kind === "topic") {
      const title = stickers.topics().find((topic) => topic.id === view.id)?.label ?? "Stickers";
      return <StickerListView title={title} query={{ topic: view.id }} onBack={home} />;
    }
    const pack = stickers.packs().find((candidate) => candidate.id === view.id);
    return (
      <StickerListView
        title={pack?.name ?? "Stickers"}
        query={{ pack: view.id }}
        credit={pack?.credit}
        onBack={home}
      />
    );
  };

  return (
    <section className="relative flex h-full flex-col gap-2 overflow-hidden p-2.5">
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          label="Topics and packs"
          active={drawer}
          onClick={() => setDrawer((open) => !open)}
        >
          <Menu />
        </IconButton>
        <input
          type="search"
          value={search}
          placeholder="Search stickers"
          aria-label="Search stickers"
          className="h-7 min-w-0 flex-1 rounded-xs border border-border bg-surface-sunken px-2 text-sm outline-none placeholder:text-subtle-foreground focus:border-ring"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {body()}
      {drawer && (
        <StickerDrawer
          view={view}
          onClose={closeDrawer}
          onPick={(next) => {
            setView(next);
            setSearch("");
            setDrawer(false);
          }}
        />
      )}
    </section>
  );
}
