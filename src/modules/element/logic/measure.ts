import type { TextMeasure, TextMeasureContext } from "../element.types";

/**
 * A `TextMeasure` over a 2D canvas context, so the engine and the canvas tools measure alike.
 * Widths follow the contract `(n-1)·letterSpacing` between letters: the canvas also adds spacing
 * after the last letter, which is taken off. Without `ctx.letterSpacing` the letters are measured
 * one by one.
 */
export function canvasTextMeasure(ctx: TextMeasureContext | null): TextMeasure {
  return (text, font, letterSpacing) => {
    if (!ctx || text === "") return 0;
    ctx.font = font;
    if ("letterSpacing" in ctx) {
      ctx.letterSpacing = `${letterSpacing}px`;
      const width = ctx.measureText(text).width;
      return letterSpacing !== 0 ? width - letterSpacing : width;
    }
    const letters = [...text];
    const sum = letters.reduce((total, letter) => total + ctx.measureText(letter).width, 0);
    return sum + letterSpacing * (letters.length - 1);
  };
}
