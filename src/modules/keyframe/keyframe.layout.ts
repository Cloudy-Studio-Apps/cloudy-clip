/** Width of the timeline's header column while the panel is open, in px. */
export const PANEL_HEADER_WIDTH = 262;
/** Height of a property row and its band, in px. */
export const ROW_HEIGHT = 24;
/** Height of a clip's summary row, in px. */
export const GROUP_HEIGHT = 22;
/** Least the panel is dragged down to, in px. */
export const MIN_PANEL_HEIGHT = 150;
/** Height of the preset strip under the panel, in px. */
export const PRESET_STRIP_HEIGHT = 46;
/** Height of the panel's toolbar, in px. */
export const PANEL_TOOLBAR_HEIGHT = 30;
/** CSS variable the panel sets on itself: how far the timeline is scrolled, in px. */
export const SCROLL_VAR = "--panel-scroll";
/** Room above and below the plane for the value labels, in px. */
export const CURVE_PADDING = 26;
/** Half the side of a key's diamond on the graph, in px. */
export const CURVE_KEY_RADIUS = 5;
/** Radius of a curve handle's knob, in px. */
export const CURVE_HANDLE_RADIUS = 5;
/** The tokens curves are drawn in, by row order. */
export const CURVE_COLORS = ["--mark", "--primary", "--foreground", "--muted-foreground"] as const;
