import { CommandFailure } from "@/core";
import type { FontFamily } from "@/modules/fonts";
import type { TextStyle } from "../text.types";

/** Fails when the patch itself asks for a weight or italic that the style's family doesn't have. */
export function checkExplicitFace(
  merged: TextStyle,
  patch: Readonly<Record<string, unknown>>,
  families: readonly FontFamily[] | undefined,
) {
  const family = families?.find((f) => f.family === merged.font.family);
  if (!family) return;
  if (patch.weight !== undefined && !family.variants.some((v) => v.weight === merged.weight)) {
    const weights = [...new Set(family.variants.map((v) => v.weight))].join(", ");
    throw new CommandFailure(
      "text.weight_unavailable",
      `"${family.family}" has no weight ${merged.weight}; available: ${weights}`,
    );
  }
  if (patch.italic === true && !family.variants.some((v) => v.style === "italic")) {
    throw new CommandFailure("text.italic_unavailable", `"${family.family}" has no italic`);
  }
}
