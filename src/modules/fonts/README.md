# fonts

The font families text can use and the loading of their faces: the two bundled families, the fonts
installed on the computer, and Google Fonts (downloaded once and cached).

- **Tier:** core
- **Requires:** `element` (the `font` prop type)
- **Contributes:** prop type `font` (`propTypes`)
- **Points it owns:** —
- **API** (`useModule(fontsRef)` / `ctx.require(fontsRef)`): `families()` (bundled, installed, Google,
  read once per kernel; offline still resolves), `knownFamilies()` (the same list, synchronously;
  `undefined` until it resolved; `setup` starts loading it in the background, commands check against it
  and never wait), `load(request)` (once per face, never rejects; a failed face is retried by the next
  `load`, `ensure` does not retry; failures are logged with `log.warn`, no toast),
  `status(request)` (`loaded` / `loading` / `missing`, `undefined` if never requested),
  `ensure(request)` (true when loaded, else starts loading), `onLoaded(listener)` (also fires on
  `missing`). `createFakeFontsModule({ families?, fail? })` (`fonts.testing.ts`) stands in for it in tests and has
  `knownFamilies()` resolved after setup.
- **Files:**
  - `fonts.library.ts`: the logic over a `FontService` (tested with a fake). Bundled faces load by
    their Fontsource name (`Inter Variable`); installed ones by name; Google ones through
    `loadGoogleFace`.
  - `fonts.service.ts`: the native and network side. `fonts_system_list` (Rust, `src-tauri/src/fonts`,
    fontdb) lists installed faces. The Google catalog is cached 7 days in `<appData>/fonts/google/catalog.json`
    (stale cache, then a short fallback list, when offline). Faces are cached under
    `<appData>/fonts/google/<slug>/<weight>[i]/` and registered with `FontFace`.
    HTTP is scoped to `fonts.google.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, files to `$APPDATA/fonts/**`
    (`capabilities/default.json`).
  - `fonts.store.ts`: per-kernel face statuses (ephemeral; type in `fonts.types.ts`).
  - `logic/`: catalog parsing, variants, merging, search; `css.ts`: `bundledCssFamily` (`"Inter"`
    is `"Inter Variable"`) and `cssFontFamily` (quoted, escaped `font-family` list with Inter and
    sans-serif fallbacks).
  - `fonts.proptype.ts`: the `font` prop type (`prop.custom("font", { sources })`, value
    `{ family, source }`, control `font-picker`); `fonts.types.ts` adds it to `CustomProps` /
    `CustomValues`. Also owns `FontWeight`, `FontSource`, `FontRef`.
- **Not yet:** font data for export (the picker lives in `text`).

| Command | MCP tool     | Notes                                               |
| ------- | ------------ | --------------------------------------------------- |
| —       | `fonts_list` | `query`, `source`, `limit` (50, max 200); read-only |
