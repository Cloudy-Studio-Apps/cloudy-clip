# UI kit

The design system of Cloudy Clip: tokens and small, stateless React components that the shell
and every module use, so the editor looks like one product and like the rest of the Cloudy
Studio family (Cloudy Canvas). Not a module: it holds no state and registers nothing.

Import it only through `@/ui` (enforced by ESLint).

## Tokens

- `styles/tokens.css`: the palette (ice, seal, blush, sand) and the semantic tokens of Cloudy
  Dark (default) and Cloudy Light (`data-theme="light"` on `<html>`).
- `styles/base.css`: page defaults, focus ring, thin square scrollbars (`data-scroll="wide"` for
  the timeline).
- `src/index.css` maps them to Tailwind. Tailwind's default colors and radii are reset, so only
  design-system values exist: `bg-surface`, `text-muted-foreground`, `border-border`,
  `rounded-xs` … `rounded-lg` (2–8px), `text-2xs` … `text-base` (10–13px), `shadow-frame`.

Shape is sharp by design: nothing above 8px. Fonts are Inter and JetBrains Mono (bundled with
Fontsource, so they work offline). Icons come from `lucide-react`.

## Components

| Export                                              | Use                                                                                                                                                                                                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                            | Text button, `primary` (one per area) or `secondary`, `sm`/`md`                                                                                                                                                                                                              |
| `IconButton`                                        | Icon-only, `label` is tooltip + aria label, `active` for toggles, `solid` for play                                                                                                                                                                                           |
| `SegmentedControl`                                  | Mutually exclusive choices (aspect ratio)                                                                                                                                                                                                                                    |
| `ToolbarButton`, `ToolbarSeparator`                 | Compact icon + label actions (timeline toolbar)                                                                                                                                                                                                                              |
| `ProgressBar`                                       | Thin determinate bar (proxy encoding)                                                                                                                                                                                                                                        |
| `EmptyState`                                        | The seal's "nothing here yet" panel                                                                                                                                                                                                                                          |
| `Waveform`                                          | Decorative audio waveform (`tileWidth` repeats it), colored with `text-*`                                                                                                                                                                                                    |
| `Dialog`                                            | Modal panel over a dim backdrop, `footer` for its buttons, closes on Escape or an outside press                                                                                                                                                                              |
| `ContextMenu`                                       | Right-click menu around its child; `items` of `MenuItem`                                                                                                                                                                                                                     |
| `Popover`                                           | Anchored floating panel (portal, outside press/Escape close, focus returns)                                                                                                                                                                                                  |
| `ColorPicker`, `ColorField`                         | Color area + hue/opacity + hex + eyedropper (if supported) + swatches/recents; `onChange(color, opacity, {done})`: drag steps `done:false`, release/hex/swatch `done:true`; drag steps move thumbs, area, opacity track and hex text through the DOM, state syncs on release |
| `SliderField`                                       | Range + number; `onInput` per move, `onCommit` once on release/Enter; no re-render while dragging (range uncontrolled, number written to the DOM)                                                                                                                            |
| `NumberField`, `SelectField`, `ToggleRow`, `Switch` | Compact number box, select, switch that shows sub-fields when on, bare switch (section headers)                                                                                                                                                                              |
| `normalizeHex`, `hexToHsv`, `hsvToHex`              | Color helpers (`lib/color.ts`)                                                                                                                                                                                                                                               |
| `Kbd`                                               | A keyboard key in running text                                                                                                                                                                                                                                               |
| `InfoList`                                          | Label/value pairs in two columns, values in mono                                                                                                                                                                                                                             |
| `SealMark`                                          | The seal logo; use it in light touches, never as clutter                                                                                                                                                                                                                     |
| `cn`                                                | Joins class names                                                                                                                                                                                                                                                            |

Fields (`SliderField`, `NumberField`, `SelectField`, `SegmentedControl`, `ColorField`, `HexInput`, `Switch`, `ToggleRow`) take `disabled`: dimmed, nothing can be changed, and a disabled `ColorField` opens no picker.
