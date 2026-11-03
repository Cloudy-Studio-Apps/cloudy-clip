/**
 * The Cloudy Clip UI kit: design-system components shared by the shell and modules (and, later,
 * plugins). Not a module: it has no state and registers nothing. Import from `@/ui` only.
 * Tokens live in `styles/tokens.css` and are mapped to Tailwind in `src/index.css`.
 * @module ui
 */

/** Joins class names, skipping falsy ones. */
export { cn } from "./lib/cn";

/** The foca watona of the Cloudy Studio family, for the logo, empty states and waiting; `rough` adds its blue construction lines. */
export { SealMark } from "./brand/SealMark";

/** The foca watona drawing itself, for an empty page; finished at once under reduced motion. */
export { SealSketch } from "./brand/SealSketch";

/** A page with nothing on it yet: the seal draws itself over a title and one line. */
export { SketchPage } from "./kit/SketchPage";
/** A text button: `primary`, `secondary` or `mark`, `sm` or `md`. */
export { Button } from "./kit/Button";
/** A square icon-only button with a tooltip; `active` for toggles, `solid` for play. */
export { IconButton } from "./kit/IconButton";
/** A row of mutually exclusive choices. */
export { SegmentedControl } from "./kit/SegmentedControl";
/** Compact toolbar actions and the separator between their groups. */
export { ToolbarButton, ToolbarSeparator } from "./kit/Toolbar";
/** A thin progress bar from 0 to 1. */
export { ProgressBar } from "./kit/ProgressBar";
/** The seal's "nothing here yet" panel, with an optional action. */
export { EmptyState } from "./kit/EmptyState";
/** A decorative waveform for audio, stretched or repeated. */
export { Waveform } from "./kit/Waveform";
/** A keyboard key in running text. */
export { Kbd } from "./kit/Kbd";
/** A modal panel over a dim backdrop, closed by Escape or a press outside. */
export { Dialog } from "./kit/Dialog";
/** A menu at the pointer, opened by a right click. */
export { ContextMenu } from "./kit/ContextMenu";
/** The entries of a menu, with shortcuts and submenus. */
export { MenuList } from "./kit/MenuList";
/** A floating panel anchored to a trigger: portal, outside-press and Escape close, focus returns. */
export { Popover } from "./kit/Popover";
/** A floating panel above a box on screen, such as a clip: it follows the box and closes on an outside press or Escape. */
export { FloatingPanel } from "./kit/FloatingPanel";
/** Saturation/brightness area, hue and opacity sliders, hex, eyedropper, swatches and recents. */
export { ColorPicker } from "./kit/ColorPicker";
/** A labelled swatch button that opens a `ColorPicker`, with hex and opacity % boxes. */
export { ColorField } from "./kit/ColorField";
/** A labelled range plus number box: `onInput` per move, `onCommit` once on release or Enter. */
export { SliderField } from "./kit/SliderField";
/** A compact number box that commits on Enter or blur. */
export { NumberField } from "./kit/NumberField";
/** A gradient: type, angle, a bar of draggable stops and the selected stop's color. */
export { GradientField } from "./kit/GradientField";
/** A small on/off switch. */
export { Switch } from "./kit/Switch";
/** A small lettered switch (M, S, R, Read): `mark` or `ink` while on; extra button props pass through. */
export { LetterToggle } from "./kit/LetterToggle";
/** A labelled switch that shows its sub-fields while on. */
export { ToggleRow } from "./kit/ToggleRow";
/** A pencilled title with a chevron that folds the fields under it. */
export { FoldSection } from "./kit/FoldSection";
/** A native select styled as the other fields. */
export { SelectField } from "./kit/SelectField";
/** Label/value pairs in two columns; values in mono. */
export { InfoList } from "./kit/InfoList";
/** Normalizes `#abc`/`abc`/`#aabbcc` to lowercase `#aabbcc`, or null. */
export { normalizeHex, hexToHsv, hsvToHex } from "./lib/color";

export type {
  SegmentedOption,
  ColorChangeInfo,
  GradientValue,
  GradientValueStop,
  Hsv,
  InfoRow,
  MenuItem,
  MenuPoint,
  PanelAnchor,
} from "./kit/kit.types";
