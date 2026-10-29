/** A field name as a label: the last path segment, camelCase split, first letter upper case. */
export function labelOf(path: string): string {
  const name = path.slice(path.lastIndexOf(".") + 1);
  const words = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
