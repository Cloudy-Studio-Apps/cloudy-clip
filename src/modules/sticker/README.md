# sticker

Stickers: pictures the user drops on the timeline from the Stickers tab, in packs, with topics that
cut across packs and optional variations.

- **Tier:** feature
- **Requires:** `project`, `element`, `preview`, `timeline`, `transform`, `inspector`
- **Contributes:** —
- **Points it owns** (`sticker.points.ts`): `stickerPacks` (packs, by `id`), `stickerStyles` (an
  option added to an axis of a pack another module owns)
- **API** (`StickerApi`): `packs`, `topics`, `load`, `isLoaded`, `find`, `axes`, `artOf`, `search`,
  `onLoaded`, `recents`
- **Files:**
  - `sticker.library.ts`: the catalog of one kernel. A pack's list loads once; a loader that fails
    notifies the user and isn't kept, so the next look tries again.
  - `logic/art.ts`: `mergeAxes` (a pack's axes plus what styles add), `resolveArt` (an option whose
    style is gone falls back to the default). `logic/search.ts`, `logic/recents.ts`.
  - `sticker.store.ts`: recently used stickers, in `localStorage`, across projects.
