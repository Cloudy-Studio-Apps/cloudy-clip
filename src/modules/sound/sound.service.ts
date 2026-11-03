import { invoke } from "@tauri-apps/api/core";
import type { Micros } from "@/core";
import type { MediaId } from "@/modules/project";

/**
 * The noise floor of `from..to` of a file's sound (file time), in dBFS, rounded and within what
 * noise reduction accepts (-80 to -20). Rejects if it can't be measured.
 */
export function measureNoiseFloor(id: MediaId, from: Micros, to: Micros): Promise<number> {
  return invoke<number>("sound_measure_floor", { id, from, to });
}
