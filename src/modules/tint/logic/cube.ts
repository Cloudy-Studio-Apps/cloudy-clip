import type { CubeLut, Rgb } from "../tint.types";

// `.cube` LUTs (the Adobe / Resolve text format) and how one is applied, the CPU reference of the
// LUT step in `render/correct.glsl.ts`. The input is mapped from the domain onto 0…1, clamped (light
// over 1 reaches this step), and the table is read at `t · (N − 1)`: trilinear between the eight
// nearest entries of a 3D table, linear between two for each channel of a 1D one. That is what the
// GPU's linear filtering gives at texel centers, `(t · (N − 1) + 0.5) / N`. Strength mixes the input
// and the result.

/** The largest 3D table read (65 points a side). */
export const MAX_CUBE_3D = 65;
/** The largest 1D table read (a texture one row high). */
export const MAX_CUBE_1D = 4096;

/** The three numbers of a line, or null when it isn't three numbers. */
function triple(parts: readonly string[]): Rgb | null {
  if (parts.length !== 3) return null;
  const rgb = parts.map(Number) as Rgb;
  return rgb.every(Number.isFinite) ? rgb : null;
}

/**
 * Reads a `.cube` file: `LUT_3D_SIZE` (2 to 65) or `LUT_1D_SIZE` (2 to 4096), `DOMAIN_MIN` /
 * `DOMAIN_MAX` (or `LUT_3D_INPUT_RANGE` / `LUT_1D_INPUT_RANGE`, the same for all three channels),
 * `TITLE` and `#` comments, then one `r g b` line per entry. Throws an `Error` saying what is wrong.
 */
export function parseCube(text: string): CubeLut {
  let kind: CubeLut["kind"] | null = null;
  let size = 0;
  const domain: [Rgb, Rgb] = [
    [0, 0, 0],
    [1, 1, 1],
  ];
  const values: number[] = [];
  const lines = text.split(/\r?\n/);
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]!.trim();
    if (line === "" || line.startsWith("#")) continue;
    const [word, ...rest] = line.split(/\s+/);
    const where = `line ${n + 1}`;
    if (word === "TITLE") continue;
    if (word === "LUT_3D_SIZE" || word === "LUT_1D_SIZE") {
      if (kind) throw new Error(`A second table size at ${where}: one table per file`);
      kind = word === "LUT_3D_SIZE" ? "3d" : "1d";
      size = Number(rest[0]);
      const max = kind === "3d" ? MAX_CUBE_3D : MAX_CUBE_1D;
      if (!Number.isInteger(size) || size < 2 || size > max) {
        throw new Error(`${word} must be 2 to ${max}, not ${rest[0] ?? "nothing"}`);
      }
      continue;
    }
    if (word === "DOMAIN_MIN" || word === "DOMAIN_MAX") {
      const rgb = triple(rest);
      if (!rgb) throw new Error(`${word} needs three numbers (${where})`);
      domain[word === "DOMAIN_MIN" ? 0 : 1] = rgb;
      continue;
    }
    if (word === "LUT_3D_INPUT_RANGE" || word === "LUT_1D_INPUT_RANGE") {
      const [lo, hi] = rest.map(Number);
      if (rest.length !== 2 || !Number.isFinite(lo) || !Number.isFinite(hi)) {
        throw new Error(`${word} needs two numbers (${where})`);
      }
      domain[0] = [lo!, lo!, lo!];
      domain[1] = [hi!, hi!, hi!];
      continue;
    }
    const rgb = triple([word!, ...rest]);
    if (!rgb) throw new Error(`Not a LUT entry or keyword at ${where}: "${line.slice(0, 40)}"`);
    if (!kind) throw new Error(`An entry before LUT_3D_SIZE or LUT_1D_SIZE (${where})`);
    values.push(...rgb);
  }
  if (!kind) throw new Error("No LUT_3D_SIZE or LUT_1D_SIZE: not a .cube LUT");
  const entries = kind === "3d" ? size ** 3 : size;
  if (values.length !== entries * 3) {
    throw new Error(`${entries} entries expected, ${values.length / 3} found`);
  }
  for (let c = 0; c < 3; c++) {
    if (!(domain[1][c]! > domain[0][c]!)) throw new Error("DOMAIN_MAX must be above DOMAIN_MIN");
  }
  return { kind, size, domain, data: new Float32Array(values) };
}

/** Where `v` falls in the table along channel `c`: 0 to `size - 1`, the domain clamped. */
function indexOf(lut: CubeLut, v: number, c: number): number {
  const lo = lut.domain[0][c]!;
  const t = Math.min(Math.max((v - lo) / (lut.domain[1][c]! - lo), 0), 1);
  return t * (lut.size - 1);
}

/** The table's value at `rgb` (`"3d"` trilinear, `"1d"` per channel), strength left out. */
export function lookupCube(lut: CubeLut, rgb: Rgb): Rgb {
  const { size, data } = lut;
  const at = [indexOf(lut, rgb[0], 0), indexOf(lut, rgb[1], 1), indexOf(lut, rgb[2], 2)];
  const lo = at.map((x) => Math.min(Math.floor(x), size - 2));
  const f = at.map((x, c) => x - lo[c]!);
  if (lut.kind === "1d") {
    return [0, 1, 2].map(
      (c) => data[lo[c]! * 3 + c]! * (1 - f[c]!) + data[(lo[c]! + 1) * 3 + c]! * f[c]!,
    ) as Rgb;
  }
  const out: Rgb = [0, 0, 0];
  for (let corner = 0; corner < 8; corner++) {
    const d = [corner & 1, (corner >> 1) & 1, (corner >> 2) & 1];
    const w = d.reduce((k, bit, c) => k * (bit ? f[c]! : 1 - f[c]!), 1);
    if (w === 0) continue;
    const i = ((lo[2]! + d[2]!) * size + lo[1]! + d[1]!) * size + lo[0]! + d[0]!;
    for (let c = 0; c < 3; c++) out[c] = out[c]! + data[i * 3 + c]! * w;
  }
  return out;
}

/** The LUT step: `rgb` mixed toward the table's value by `strength` (0 to 1). */
export function applyCube(rgb: Rgb, lut: CubeLut, strength: number): Rgb {
  const looked = lookupCube(lut, rgb);
  return [0, 1, 2].map((c) => rgb[c]! + (looked[c]! - rgb[c]!) * strength) as Rgb;
}
