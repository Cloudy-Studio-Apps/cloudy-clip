/**
 * The Cloudy Clip UI kit: design-system components shared by the shell and modules (and, later,
 * plugins). Not a module: it has no state and registers nothing. Import from `@/ui` only.
 * Tokens live in `styles/tokens.css` and are mapped to Tailwind in `src/index.css`.
 * @module ui
 */

/** Joins class names, skipping falsy ones. */
export { cn } from "./lib/cn";

/** The seal mark of the Cloudy Studio family, for the logo, empty states and waiting. */
export { SealMark } from "./brand/SealMark";

/** A text button, `primary` or `secondary`, `sm` or `md`. */
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
/** A floating panel anchored to a trigger: portal, outside-press and Escape close, focus returns. */
export { Popover } from "./kit/Popover";
/** Saturation/brightness area, hue and opacity sliders, hex, eyedropper, swatches and recents. */
export { ColorPicker } from "./kit/ColorPicker";
/** A labelled swatch button that opens a `ColorPicker`, with hex and opacity % boxes. */
export { ColorField } from "./kit/ColorField";
/** A labelled range plus number box: `onInput` per move, `onCommit` once on release or Enter. */
export { SliderField } from "./kit/SliderField";
/** A compact number box that commits on Enter or blur. */
export { NumberField } from "./kit/NumberField";
/** A labelled switch that shows its sub-fields while on. */
export { ToggleRow } from "./kit/ToggleRow";
/** A native select styled as the other fields. */
export { SelectField } from "./kit/SelectField";
/** Label/value pairs in two columns; values in mono. */
export { InfoList } from "./kit/InfoList";
/** Normalizes `#abc`/`abc`/`#aabbcc` to lowercase `#aabbcc`, or null. */
export { normalizeHex, hexToHsv, hsvToHex } from "./lib/color";

export type { SegmentedOption, ColorChangeInfo, Hsv, InfoRow } from "./kit/kit.types";
