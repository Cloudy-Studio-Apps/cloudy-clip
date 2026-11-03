# UI kit

The design system of Cloudy Clip: tokens and small, stateless React components that the shell
and every module use, so the editor looks like one product and like the rest of the Cloudy
Studio family (Cloudy Canvas). Not a module: it holds no state and registers nothing.

Import it only through `@/ui` (enforced by ESLint).

## Tokens

- `styles/tokens.css`: the palette (ice, seal, blush, sand) and the semantic tokens of Cloudy
  Dark, the default. Other themes change these values at runtime (`src/modules/theme`), so
  components use tokens and never read a theme.
- `styles/base.css`: page defaults, focus ring, thin square scrollbars (`data-scroll="wide"` for
  the timeline).
- `src/index.css` maps them to Tailwind. Tailwind's default colors and radii are reset, so only
  design-system values exist: `bg-surface`, `text-muted-foreground`, `border-border`,
  `rounded-xs` … `rounded-lg` (2–8px), `text-2xs` … `text-md` (10–14px), `text-display`, `shadow-frame`.

Shape is sharp by design: nothing above 8px, and only avatars, switch and slider thumbs and EQ points are round.
Type scale is `text-2xs`…`text-md` (10–14px), plus `text-display` for the wordmark. UI fonts are Shantell
Sans (`font-hand`, for titles, tabs and buttons), Atkinson Hyperlegible and Courier Prime (bundled with
Fontsource, so they work offline). Inter and JetBrains Mono stay bundled for text clips. The look follows
`docs/prototype/designs/b-mesa-de-noche.html`. Icons come from `lucide-react`.

Red (`mark`) marks what you touched: the playhead, the selected clip, active tabs, changed values.
Anything merely on uses `on`, blue pencil.

## Components

| Export                                              | Use                                                                                                                                                                                                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                            | Text button, `primary` (one per area) or `secondary`, `sm`/`md`                                                                                                                                                                                                              |
| `IconButton`                                        | Icon-only, `label` is tooltip + aria label, `active` for toggles, `solid` for play; `tone` `mark` (record), `on` (a switch drawn on in `--on`, no fill) or `mark-filled` (recording) keeps its colour on hover; `busy`: disabled while something runs, not dimmed            |
| `SegmentedControl`                                  | Mutually exclusive choices (aspect ratio, page tabs); an option can have an `icon` and a divider before it (`divided`)                                                                                                                                                       |
| `ToolbarButton`, `ToolbarSeparator`                 | Compact icon + label actions (timeline toolbar)                                                                                                                                                                                                                              |
| `ProgressBar`                                       | Thin determinate bar (proxy encoding)                                                                                                                                                                                                                                        |
| `EmptyState`                                        | The seal's "nothing here yet" panel                                                                                                                                                                                                                                          |
| `Waveform`                                          | Decorative audio waveform (`tileWidth` repeats it), colored with `text-*`                                                                                                                                                                                                    |
| `Dialog`                                            | Modal panel over a dim backdrop, `footer` for its buttons, `size="wide"` for side-by-side content, closes on Escape or an outside press                                                                                                                                      |
| `ContextMenu`                                       | Right-click menu around its child, kept inside the window; `items` of `MenuItem`, or a function of where the click landed                                                                                                                                                    |
| `MenuList`                                          | The entries of a menu: `icon` before the label, `shortcut` on the right, `items` opens a submenu, and a dashed rule where `group` changes. `ContextMenu` uses it                                                                                                             |
| `Popover`                                           | Anchored floating panel (portal, outside press/Escape close, focus returns)                                                                                                                                                                                                  |
| `ColorPicker`, `ColorField`                         | Color area + hue/opacity + hex + eyedropper (if supported) + swatches/recents; `onChange(color, opacity, {done})`: drag steps `done:false`, release/hex/swatch `done:true`; drag steps move thumbs, area, opacity track and hex text through the DOM, state syncs on release |
| `GradientField`                                     | Linear or Radial, angle, a bar of stops (a click adds one, 2 to 8) and the selected stop's color; `onChange(value, {done})`; dragging a stop moves the bar through the DOM, no re-render. `kit.gradient.ts`: `barBackground`, `stopAt`                                       |
| `SliderField`                                       | Range + number; `onInput` per move, `onCommit` once on release/Enter; no re-render while dragging (range uncontrolled, number written to the DOM). `bare` leaves out the label, as `ColorField`'s does                                                                       |
| `FoldSection`                                       | Stateless accordion band: chevron, title, `leading` and `actions` slots. The caller keeps `open`                                                                                                                                                                             |
| `NumberField`, `SelectField`, `ToggleRow`, `Switch` | Compact number box (`prefix` + `onInput`: a short name that scrubs, `NumberScrub`, no re-render while dragging), select, switch that shows sub-fields when on, bare switch (section headers)                                                                                 |
| `normalizeHex`, `hexToHsv`, `hsvToHex`              | Color helpers (`lib/color.ts`)                                                                                                                                                                                                                                               |
| `Kbd`                                               | A keyboard key in running text                                                                                                                                                                                                                                               |
| `LetterToggle`                                      | A small lettered switch (M, S, R, Read: mixer strips, track headers): `on`, `label` (tooltip + aria label), `tone` `mark` (mute, arm) or `ink` (solo) while on; other button props pass through                                                                              |
| `InfoList`                                          | Label/value pairs in two columns, values in mono                                                                                                                                                                                                                             |
| `SketchPage`                                        | A page with nothing on it yet: `SealSketch` over a title and one line                                                                                                                                                                                                        |
| `SealSketch`                                        | The foca watona drawing itself, once per mount; shows finished under reduced motion                                                                                                                                                                                          |
| `SealMark`                                          | The foca watona; `rough` adds its blue construction lines, large sizes only. Light touches, never clutter                                                                                                                                                                    |
| `cn`                                                | Joins class names                                                                                                                                                                                                                                                            |

`IconButton`, `ToolbarButton`, `Button` and `LetterToggle` honour `aria-disabled="true"` for a control that is shown but doesn't work yet: no hover change, an arrow pointer, otherwise the normal look (unlike `disabled`, which dims). The caller supplies the tooltip and a click that does nothing.

Fields (`SliderField`, `NumberField`, `SelectField`, `SegmentedControl`, `ColorField`, `HexInput`, `Switch`, `ToggleRow`) take `disabled`: dimmed, nothing can be changed, and a disabled `ColorField` opens no picker.
