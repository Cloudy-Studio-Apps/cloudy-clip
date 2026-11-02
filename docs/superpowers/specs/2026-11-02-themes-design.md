# Themes

## Why

Clip has the start of a theme system and none of it runs. `tokens.css` holds Cloudy Dark and Cloudy Light, but
nothing sets `data-theme`, so the app is always dark and Light has never been seen. There is no settings
window to choose from. Cloudy Canvas already solved this, so Clip follows it where the two apps match and
keeps the same theme format, so the family stays one system.

## Goals

1. A Settings window, where the user picks a theme from cards. It applies at once and survives restarts,
   with no flash of the wrong theme at startup.
2. A theme can set colors, fonts, corners and density (Compact, Default, Comfortable).
3. Built-in themes and future plugin themes use one door: the `themes` point. A plugin theme has the same
   powers as a built-in one.
4. The default look does not change by a single pixel. Cloudy Dark at Default density is today's app.

## Non-goals

- A theme editor or user-made themes inside the app. Themes come from the app or from plugins.
- The plugin loader. This work creates the point a loader will use, nothing more.
- Themes changing the video. Preview, capture and export never depend on the theme.
- Search over themes, until there are enough to need it.
- Per-project themes. The theme belongs to the person and the machine.
- Agents changing the theme. It's the user's own screen, so no MCP tools.
- A text and interface size setting, for now.

## What a theme is

The Canvas format: plain data that lists only what it changes.

```ts
defineTheme({
  id: "plugin-nord-dark",
  label: "Nord Dark",
  description: "Cool arctic blues.",
  family: "Nord", // a light and a dark theme with one family share a card
  appearance: "dark",
  extends: "cloudy-dark", // optional
  tokens: { background: "#2e3440", foreground: "#eceff4" },
  fonts: { sans: "…", mono: "…", hand: "…" },
  corners: { control: 4, card: 6, max: 8 },
  density: "default",
  preview: { background: "#2e3440", surface: "#3b4252", primary: "#88c0d0", foreground: "#eceff4" },
});
```

**Differences from Canvas, on purpose.**

- `extends` unset means Cloudy Dark, not Light: Clip is a dark-first editor.
- `fonts` has `hand` as well, because Clip's titles, tabs and buttons use it.
- No `products`. Clip has one editor.
- `tokens` are Clip's names. A Canvas theme's unknown tokens are left out with a warning, so one can be
  brought over and only needs Clip's own tokens added.

**Tokens.** `THEME_TOKEN_NAMES` is every semantic token in `tokens.css`, plus the clip fills, plus two new ones
(see Light). Palette scales are not tokens, but they can be used as values.

**Corners.** `control`, `card`, `max` become `--radius-xs` (`control / 2`), `--radius-sm` (`control`), `--radius-md`
(`card`), `--radius-lg` (`max`). The defaults 4, 6, 8 give exactly today's 2, 4, 6, 8. Each is clamped to 8.

**Fonts.** `sans`, `mono`, `hand` override `--font-sans`, `--font-mono`, `--font-hand`. Text clips never read these.
A theme can only name a font that is already there, bundled or installed. Shipping font files waits for the plugin
loader.

**Density.** A theme suggests one, the user may override it. Sizes are CSS variables, and these are the values:

| Token             | Compact | Default (today) | Comfortable |
| ----------------- | ------- | --------------- | ----------- |
| `--control-h-sm`  | 24      | 28              | 32          |
| `--control-h`     | 26      | 30              | 34          |
| `--control-h-lg`  | 30      | 34              | 38          |
| `--row-h`         | 22      | 26              | 30          |
| `--control-px`    | 8       | 12              | 14          |
| `--track-h-video` | 52      | 64              | 76          |
| `--track-h-audio` | 36      | 44              | 52          |

The font list stays at 28px rows: it is virtualized on a number, and it is one small list. Text size does not
change with density.

**A single source for the default.** `tokens.css` keeps the palette and Cloudy Dark, so the app paints correctly
even if the `theme` module fails to load. The `cloudy-dark` preset lists no tokens of its own. Cloudy Light moves
from `tokens.css` to its preset, which has to set every color token.

**Safety.** The theme's values are written into a style sheet, so plugin data is checked when read. As in Canvas,
characters that could end a declaration are refused (`; { } < > \`). Clip also refuses `url(` and `@import`, so a
theme can't load anything from the network. Canvas doesn't check that today.

**Reading a theme.** `readTheme` checks one definition. A broken one is left out, logged and shown with
`notify`; the rest still load. Unknown tokens are dropped with a warning.

## Choosing and applying

**Choice.** `{ mode: "fixed" | "system", themeId, lightThemeId, darkThemeId, density }`, in a per-kernel store,
saved to `localStorage` under `cloudy-clip.theme`, like the other per-machine choices. `density` null means the
theme's own. It is not in the document or in history, so Ctrl+Z never touches it.

**A theme that isn't there.** A saved theme whose plugin is missing falls back to the built-in of its appearance
(Cloudy Dark or Light). The saved id is kept, so it returns if the plugin does. Settings says it is missing.

**Applying.** `applyTheme` writes `<style id="cloudy-theme">` with `html:root { … }` (stronger than `tokens.css`),
sets `data-theme` and `data-appearance`, and caches the CSS in `cloudy-clip.theme-css`. `index.html` injects the
cache from a small inline script before first paint. The CSP is null, so inline scripts are allowed. The first
run has no cache and paints Cloudy Dark.

It re-applies when the choice changes, when the OS appearance changes in system mode, and when the `themes`
point changes (a plugin theme arriving late).

**The video stays out of it.** Only one piece of drawing reads a token: `transition/ui/thumbnail.draw.ts`. It gets
fixed colors, so its small pictures need no redraw. Nothing that reaches preview or export reads tokens.

## Modules

**`settings` (feature).** The Settings window. Owns the `settingsSections` point (`{ id, label, order, component }`),
the `settings.open` command, the dialog as an `appOverlays` entry, a logo-menu entry and `Ctrl+,`. It knows nothing
about themes, so plugins can add sections later.

**`theme` (feature, requires `settings`).** Owns the `themes` point, the logic, the store, `applyTheme`, the
built-in presets, `theme.set` and the Appearance section. It is a feature because the app still works without
it, in Cloudy Dark.

- `theme.set`, non-undoable: any of `mode`, `themeId`, `lightThemeId`, `darkThemeId`, `density`. An unknown id
  fails with `theme.unknown`.
- No MCP tools: agents can't change the user's theme.
- Public API: `defineTheme`, `themes`, `THEME_TOKEN_NAMES`, `themeRef` with `{ store, list(), active(), onChange() }`.

## Settings › Appearance

One card per family: a small picture of the theme (background, panel, text lines, a primary button), its name and
description, and a Light/Dark switch when the family has both. App themes come first; themes of each plugin come
after, under the plugin's name. Then Match system with a dark and a light pick. Density with Theme default,
Compact, Default and Comfortable joins them when density is built. Choosing applies at once; there is no Save button. Escape closes.

## Built-in themes

Cloudy Dark (default) and Cloudy Light, as two cards. More can be ported from Canvas later, each needing Clip's
own tokens (`mark`, `on`, `stage`, `lane`, clip fills) filled in.

## Light has to be made right

Light has never run. Known problems, each checked in the code:

- Clip names use `text-foreground` on fills fixed to dark colors, so in Light they'd be dark on dark. The fills
  become theme tokens, with a new `clip-foreground`.
- `Button`'s primary hover is `bg-white`, which on Light gives white text on a white button. It becomes a new token, `ink-hover`.
- `ProgressBar` is `bg-white/25` and `bg-ice-400`. It also shows on a panel (`SpeedSection`), so in Light its
  track would be invisible. It must follow the theme and still read over thumbnails.

Colors over the video or a picture stay fixed: `MediaThumb` badges, `SelectionBox` and guides on the stage, media
backdrops (`bg-black`), the Dialog dim. So do document colors, swatches, the color pickers and brand art.

## Testing

Rule 3 keeps tests small here. One test file stays: `readTheme` refusing unsafe values, a safety bug nothing else
would catch. The rest is checked by hand in the real app: every theme on every page, and all three densities. A
pixel compare of Cloudy Dark at Default against today's build proves goal 4.

## Decisions

- **Density comes last.** It touches about 30 files, many in the timeline and inspector the keyframes work is
  changing, so it's built after keyframes and the rest of this work are finished.
- **Timeline track height follows density.**
- **The title bar follows the theme's appearance,** through Tauri's `setTheme`, with one capability,
  `core:window:allow-set-theme`.
- **Two built-in themes:** Cloudy Dark and Cloudy Light.
- **Plugin font files wait** for the plugin loader.
- **UI scale waits** for a later plan.
- **Agents can't change the theme.** A choice over rule 1: the theme is the user's own, not part of the project.

## Calls I made

- `settings` and `theme` are two modules, so Settings is not tied to themes.
- A window, not a page in the top bar: you keep your place in the edit.
- Corners keep Canvas's three names over Clip's four-step scale.
- Density has no global spacing multiplier. Changing Tailwind's `--spacing` would give half-pixel heights and
  blurred 1px borders.
- The transition thumbnails use fixed colors instead of following the theme.
- `Ctrl+,` opens Settings, the usual shortcut for it.
