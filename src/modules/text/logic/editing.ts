import type { TextStylePatch } from "../text.types";

/**
 * What ending an in-place edit does: nothing when the words did not change, a revert when they
 * were emptied (a text clip never has blank words), else a commit.
 */
export function editCommitAction(before: string, after: string): "none" | "revert" | "commit" {
  if (after === before) return "none";
  if (after.trim() === "") return "revert";
  return "commit";
}

/**
 * Live style that makes the canvas draw nothing visible while the editor shows the words. It
 * keeps size, font and spacing, so the box (and the selection outline) stays the same.
 */
export const EDIT_HIDDEN_STYLE: TextStylePatch = {
  fill: { opacity: 0 },
  shadow: { enabled: false },
  outline: { enabled: false },
  background: { opacity: 0 },
};
