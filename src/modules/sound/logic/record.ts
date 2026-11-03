import { toAppError } from "@/core";
import type { Track } from "@/modules/project";
import type { RecordPlatform } from "../sound.types";

/**
 * Where recording has been checked to work (`docs/superpowers/specs/2026-11-03-microphone-check.md`).
 * Elsewhere the record and arm buttons are absent. Windows waits for the owner's WebView2 check;
 * macOS needs `NSMicrophoneUsageDescription` in the bundle first.
 */
export const RECORDING_CHECKED: Readonly<Record<RecordPlatform, boolean>> = {
  linux: true,
  windows: false,
  macos: false,
  android: false,
};

/** The platform a webview's user agent names. */
export function platformOf(userAgent: string): RecordPlatform {
  if (/Android/i.test(userAgent)) return "android";
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macos";
  return "linux";
}

/** Whether a track can be armed for recording: an audio track that isn't muted. */
export function canArm(track: Track | undefined): track is Track {
  return track?.kind === "audio" && !track.muted;
}

/** The folder a project file sits in: `/` (or `C:\`) for one at the root. */
export function folderOf(path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (cut < 0) return path;
  return cut === 0 || path[cut - 1] === ":" ? path.slice(0, cut + 1) : path.slice(0, cut);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The file name of a take started at `date`, without the extension: `Recording 2026-11-03 14-05-09`. */
export function takeStem(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `Recording ${day} ${time}`;
}

/** Samples from -1..1 as 16-bit integers, clipped, and their peak (linear). */
export function toPcm16(block: Float32Array): { pcm: Int16Array; peak: number } {
  const pcm = new Int16Array(block.length);
  let peak = 0;
  for (let i = 0; i < block.length; i++) {
    const sample = Math.max(-1, Math.min(1, block[i]!));
    peak = Math.max(peak, Math.abs(sample));
    pcm[i] = Math.round(sample * (sample < 0 ? 0x8000 : 0x7fff));
  }
  return { pcm, peak };
}

/** One run of bytes from 16-bit chunks, little-endian as the WAV wants (every webview is). */
export function joinChunks(chunks: readonly Int16Array[], length: number): Uint8Array {
  const joined = new Int16Array(length);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.length;
  }
  return new Uint8Array(joined.buffer);
}

/** What to tell the user when the microphone or the take's file couldn't be had. */
export function startFailure(error: unknown): string {
  // `getUserMedia` rejects with a DOMException named for the reason.
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "NotAllowedError") {
    return "The microphone isn't allowed. Check that apps may use it in your system's privacy settings.";
  }
  if (name === "NotFoundError") return "No microphone was found. Plug one in and try again.";
  if (name === "NotReadableError") return "The microphone is busy or can't be read.";
  return `Recording couldn't start: ${toAppError(error).message}`;
}
