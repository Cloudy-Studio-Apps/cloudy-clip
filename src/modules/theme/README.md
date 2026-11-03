# theme

The look of the interface: colors, fonts and corners. A theme is plain data that lists only what it changes, in the same format as Cloudy Canvas. The user picks one in Settings › Appearance; it applies at once and survives restarts. It belongs to the user and the machine, so it is not in the project, not in history, and agents can't change it. Nothing that reaches the video reads a theme: preview, capture and export stay the same in every theme.

- **Tier:** feature
- **Requires:** `settings`
- **Contributes:** section `theme.appearance` (`settingsSections`), the built-in themes (`themes`)
- **API:** `store` (the `ThemeChoice`), `list()`, `active()`, `onChange(listener)`
- **Points it reads:** `themes`
- **Commands:** `theme.set`, not undoable: any of `mode`, `themeId`, `lightThemeId`, `darkThemeId`, `density`. Fails with `theme.unknown`. It has no MCP tool on purpose.
- **Exports:** `defineTheme`, `themes`, `setTheme`, `THEME_TOKEN_NAMES`, `themeRef`, the types.

## Adding a theme

A module or a plugin contributes to `themes`. A plugin theme has the same powers as a built-in one.

```ts
contribute(
  themes,
  defineTheme({
    id: "plugin-nord-dark", // unique among all themes
    label: "Nord Dark",
    description: "Cool arctic blues.",
    family: "Nord", // a light and a dark theme with one family share a card
    appearance: "dark",
    extends: "cloudy-dark", // Cloudy Dark when unset. A light theme extends cloudy-light
    tokens: { background: "#2e3440", foreground: "#eceff4" },
    fonts: { sans: '"Inter Variable", sans-serif' }, // sans, mono, hand
    corners: { control: 4, card: 6, max: 8 }, // px, clamped to 8
    density: "default",
    preview: {
      background: "#2e3440",
      surface: "#3b4252",
      primary: "#88c0d0",
      foreground: "#eceff4",
    },
    owner: "Nord theme", // its heading in Settings. The app's themes leave it out
  }),
);
```

- `THEME_TOKEN_NAMES` lists every token. Palette scales aren't tokens, but values may use them (`var(--seal-900)`).
- Unknown tokens are left out with a warning, so a Canvas theme can be brought over and only needs Clip's own tokens added: `mark`, `on`, `stage`, `lane`, `dim`, `ink-hover` and the `clip-*` fills.
- A font must already be there, bundled or installed. Themes can't ship font files yet.
- Values are written into a style sheet, so `readTheme` refuses anything that could end a declaration or load something (`; { } < > \`, `url(`, `@import`). A broken theme is left out and reported; the rest still load.

## How it works

- **The default.** `src/ui/styles/tokens.css` is Cloudy Dark, so the app paints correctly even without this module. The `cloudy-dark` preset lists no tokens. Cloudy Light sets every color, because what's under it is dark.
- **Resolving.** `resolveTheme` merges the `extends` chain. A chain that loops or names a missing theme stops where it breaks. `themeCss` writes it as `html:root`, which beats `tokens.css`. Corners map to the `--radius-*` scale: `control / 2`, `control`, `card`, `max`.
- **Applying.** `theme.service.ts` re-applies when the choice, the OS appearance or the `themes` point changes. `theme.apply.ts` writes `<style id="cloudy-theme">`, sets `data-theme` and `data-appearance` on `<html>` and caches the CSS.
- **Before first paint.** A script in `index.html` injects that cache, so the right theme shows from the first frame. The first run paints Cloudy Dark.
- **A theme that isn't there.** It falls back to the built-in of its appearance. The saved id stays, so it returns with its plugin, and Settings says so.
- **Drawing that reads tokens.** A canvas that reads colors when it draws redraws when `data-theme` on `<html>` changes (the keyframe curves do, with a `MutationObserver`), so it needs no dependency on this module. `onChange` is there for code that already requires it.
- **The title bar.** `theme.window.ts` sets the OS title bar with the theme's appearance. In `system` mode it hands it back to the OS, because a set theme also changes what `prefers-color-scheme` reports and would hide the OS's changes.

## Files

`logic/` holds the pure parts (`read.ts`, `resolve.ts`, `css.ts`, `active.ts`, `families.ts`, `density.ts`, `tokens.ts`), `presets/` the built-in themes, `ui/` the Appearance section.

**Not yet:** density in the interface. The values and the choice exist, but controls still use fixed sizes, and there is no Density setting. Then: UI scale, more built-in themes, font files from plugins.
