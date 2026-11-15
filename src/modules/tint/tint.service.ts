import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { hash } from "./render/textures";
import { parseCube } from "./logic/cube";
import type { LoadedLut } from "./tint.types";

/**
 * Reads and parses a `.cube` file at an absolute path (at most 8 MB, UTF-8; `tint_read_lut` on the
 * native side). Rejects with the native `{ code, message }` (`not_found` when the file isn't there,
 * `invalid_input` for a wrong path or file) or with the parser's `Error`.
 */
export async function readLut(path: string): Promise<LoadedLut> {
  const text = await invoke<string>("tint_read_lut", { path });
  return { table: parseCube(text), version: hash(text) };
}

/** Asks the person for a `.cube` file: its path, or null when they cancel. */
export async function askLutFile(title: string): Promise<string | null> {
  const path = await open({
    multiple: false,
    directory: false,
    title,
    filters: [{ name: "LUT", extensions: ["cube", "CUBE"] }],
  });
  return typeof path === "string" ? path : null;
}
