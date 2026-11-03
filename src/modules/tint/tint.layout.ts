/** Sizes of the Tint page, from the layout D mockup. */
export const TINT_LAYOUT = {
  /** Width of the grade panel in Baby Seal. */
  gradeWidth: 372,
  /** Height of the clips bar. */
  clipsHeight: 172,
  /** Height of the tools and scopes row. */
  lowerHeight: 330,
  /** View box of the node graph. */
  graph: { width: 1030, height: 380 },
  /** Size of a correction node in the graph. */
  node: { width: 116, height: 82 },
  /** Size of a channel node in the graph. */
  channel: { width: 66, height: 38 },
  /** Diameter of a join or split node in the graph. */
  joint: 40,
} as const;
