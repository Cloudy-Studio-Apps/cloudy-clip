/** A patch that sets `value` at a dotted path: `("outline.width", 4)` → `{ outline: { width: 4 } }`. */
export function pathPatch(path: string, value: unknown): Record<string, unknown> {
  return path.split(".").reduceRight<unknown>((inner, key) => ({ [key]: inner }), value) as Record<
    string,
    unknown
  >;
}
