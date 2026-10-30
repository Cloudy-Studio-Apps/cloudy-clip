# sticker

Stickers: pictures the user drops on the timeline from the Stickers tab, in packs, with topics that
cut across packs and optional variations.

- **Tier:** feature
- **Requires:** `project`, `element`, `preview`, `timeline`, `transform`, `inspector`
- **Contributes:** element `sticker`; prop type `sticker-variation`
- **Points it owns** (`sticker.points.ts`): `stickerPacks` (packs, by `id`), `stickerStyles` (an
  option added to an axis of a pack another module owns)
- **API** (`StickerApi`): `packs`, `topics`, `load`, `isLoaded`, `hasFailed`, `find`, `axes`, `artOf`, `search`,
  `onLoaded`, `recents`
- **Files:**
  - `sticker.library.ts`: the catalog of one kernel. A pack's list loads once; a loader that fails
    notifies the user and isn't kept, so the next look tries again.
  - `logic/art.ts`: `mergeAxes` (a pack's axes plus what styles add), `resolveArt` (an option whose
    style is gone falls back to the default). `logic/search.ts`, `logic/recents.ts`.
  - `sticker.store.ts`: recently used stickers, in `localStorage`, across projects.
  - `sticker.element.ts`: `createStickerElement(library, art)`. A clip stores `pack`, `sticker` and
    `variation`, never the art. A clip of a removed pack or sticker stays put, draws a dashed
    placeholder and never holds the frame; `ready` says no only while a list or image loads.
  - `sticker.art.ts`: decoded art per kernel. Images are rasterized at the size they show at, in
    powers of two, again only when larger, at most 64 kept.
  - `logic/size.ts`: the longer side is `STICKER_SHARE` (0.3) of the frame's short side.

| Command       | MCP tool             | Notes                                                                                                                                   |
| ------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `sticker.add` | `sticker_add`        | `pack`, `sticker`, optional `variation`, `start`, `duration`, `trackId`. `sticker.unknown_pack`, `unknown_sticker`, `invalid_variation` |
| —             | `sticker_list_packs` | packs with counts and credits, topics                                                                                                   |
| —             | `sticker_search`     | `text`, `topic`, `pack`, `limit` (50): stickers, whether animated, their variations                                                     |
