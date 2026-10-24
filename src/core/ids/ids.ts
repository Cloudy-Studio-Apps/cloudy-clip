const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Creates a short random id with a readable prefix, e.g. `clip_k3j9x2`. Short ids keep MCP
 * payloads small and are easy for agents (and humans reading logs) to reference.
 */
export function createId(prefix: string, length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = "";
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return `${prefix}_${id}`;
}
