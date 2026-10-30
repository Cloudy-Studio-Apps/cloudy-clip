# sticker

Stickers: pictures the user drops on the timeline from the Stickers tab, in packs, with topics that
cut across packs and optional variations.

- **Tier:** feature
- **Requires:** `project`, `element`, `preview`, `timeline`, `transform`, `inspector`
- **Contributes:** panel `sticker.panel` (side); element `sticker`; prop type, control and section layout `sticker-variation`
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
  - `sticker.lottie.ts`: animated art, `lottie-web`'s light canvas build, imported on first use. It
    never plays: each draw seeks to the clip's time, looped, so paused, scrubbing, capture and a
    hidden window all show the exact frame, and one player serves any number of clips.
  - `logic/size.ts`: the longer side is `STICKER_SHARE` (0.3) of the frame's short side.

  - `ui/`: `StickersPanel` (the tab, its view is local state), `StickerHome` (recently used, pack
    covers), `StickerDrawer` (topics, installed packs), `StickerListView` + `StickerGrid` (a full
    grid; only the rows in view are drawn, `sticker.window.hook.ts`).
  - `ui/VariationControl.tsx`: one row per axis with two options or more, swatches when they have
    them. The section is left out for a sticker with nothing to choose.
- **Not yet:** Fluent's Color and 3D styles and other emoji groups, skin tones, Noto's animated
  emoji (each a future plugin; they need a plugin loader so they can stay optional), GIFs, an online
  catalog, the user's own stickers.

A plugin adds a pack with `contribute(stickerPacks, defineStickerPack({ id, name, order, stickers }))`.
A sticker needs only `id`, `label` and `art`. To add a style to a pack it doesn't own, without
repeating its stickers:

```ts
contribute(
  stickerStyles,
  defineStickerStyle({
    pack: "fluent",
    axis: "style",
    option: { id: "color", label: "Color" },
    art: (sticker) => ({ type: "image", url: colorUrl(sticker.id) }),
  }),
);
```

The inspector shows an axis once it has two options. If the plugin goes, clips using its option
fall back to the default. Animated art is Lottie JSON with `type: "lottie"` and a `thumbnail`.

| Command       | MCP tool             | Notes                                                                                                                                   |
| ------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `sticker.add` | `sticker_add`        | `pack`, `sticker`, optional `variation`, `start`, `duration`, `trackId`. `sticker.unknown_pack`, `unknown_sticker`, `invalid_variation` |
| —             | `sticker_list_packs` | packs with counts and credits, topics                                                                                                   |
| —             | `sticker_search`     | `text`, `topic`, `pack`, `limit` (50): stickers, whether animated, their variations                                                     |
