import type { Hsv } from "../kit/kit.types";

/** `#abc`, `abc` or `#aabbcc` (any case) as lowercase `#aabbcc`; null when it isn't a hex color. */
export function normalizeHex(input: string): string | null {
  const text = input.trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]+$/.test(text)) return null;
  if (text.length === 3) return `#${text[0]}${text[0]}${text[1]}${text[1]}${text[2]}${text[2]}`;
  return text.length === 6 ? `#${text}` : null;
}

/** `#rrggbb` as HSV (h 0–360, s and v 0–1); black when the input isn't a hex color. */
export function hexToHsv(hex: string): Hsv {
  const value = normalizeHex(hex) ?? "#000000";
  const r = parseInt(value.slice(1, 3), 16) / 255;
  const g = parseInt(value.slice(3, 5), 16) / 255;
  const b = parseInt(value.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

/** HSV as lowercase `#rrggbb`. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}
