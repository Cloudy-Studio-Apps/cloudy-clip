import type {
  ExportFormat,
  ExportFormatInfo,
  ExportKind,
  ExportEffort,
  ExportIfExists,
  ExportBitDepth,
  ExportSampleRate,
} from "../export.types";

/** The kinds on the page. `custom` is whatever the slider says. */
export const EXPORT_KINDS: readonly { id: ExportKind; label: string; quality: number | null }[] = [
  { id: "default", label: "Default", quality: 70 },
  { id: "small", label: "Small", quality: 35 },
  { id: "best", label: "Best", quality: 95 },
  { id: "custom", label: "Custom", quality: null },
];

/** The formats on the page, in this order. */
export const EXPORT_FORMATS: readonly ExportFormatInfo[] = [
  {
    id: "h264",
    short: "H.264",
    label: "MP4 (H.264), plays everywhere",
    extension: "mp4",
    picture: true,
    sound: true,
    quality: true,
    sizeFactor: 1,
    timeFactor: 1,
  },
  {
    id: "h265",
    short: "H.265",
    label: "MP4 (H.265), smaller",
    extension: "mp4",
    picture: true,
    sound: true,
    quality: true,
    sizeFactor: 0.6,
    timeFactor: 2.2,
  },
  {
    id: "webm",
    short: "VP9",
    label: "WebM (VP9), for websites",
    extension: "webm",
    picture: true,
    sound: true,
    quality: true,
    sizeFactor: 0.7,
    timeFactor: 3,
  },
  {
    id: "prores",
    short: "ProRes",
    label: "MOV (ProRes), for other editors",
    extension: "mov",
    picture: true,
    sound: true,
    quality: false,
    sizeFactor: 9,
    timeFactor: 0.8,
  },
  {
    id: "gif",
    short: "GIF",
    label: "GIF, no sound",
    extension: "gif",
    picture: true,
    sound: false,
    quality: true,
    sizeFactor: 3,
    timeFactor: 1.2,
  },
  {
    id: "mp3",
    short: "MP3",
    label: "MP3, sound only",
    extension: "mp3",
    picture: false,
    sound: true,
    quality: false,
    sizeFactor: 0,
    timeFactor: 0.1,
  },
  {
    id: "wav",
    short: "WAV",
    label: "WAV, sound only, lossless",
    extension: "wav",
    picture: false,
    sound: true,
    quality: false,
    sizeFactor: 0,
    timeFactor: 0.1,
  },
  {
    id: "flac",
    short: "FLAC",
    label: "FLAC, sound only, lossless",
    extension: "flac",
    picture: false,
    sound: true,
    quality: false,
    sizeFactor: 0,
    timeFactor: 0.1,
  },
  {
    id: "aac",
    short: "AAC",
    label: "AAC (M4A), sound only",
    extension: "m4a",
    picture: false,
    sound: true,
    quality: false,
    sizeFactor: 0,
    timeFactor: 0.1,
  },
  {
    id: "opus",
    short: "Opus",
    label: "Opus, sound only, 48 kHz",
    extension: "opus",
    picture: false,
    sound: true,
    quality: false,
    sizeFactor: 0,
    timeFactor: 0.1,
  },
];

/** Default settings of the zod schema and of a fresh page. */
export const DEFAULT_QUALITY = 70;
export const DEFAULT_EFFORT: ExportEffort = "balanced";
export const DEFAULT_SAMPLE_RATE: ExportSampleRate = 48000;
export const DEFAULT_BIT_DEPTH: ExportBitDepth = 16;
export const DEFAULT_IF_EXISTS: ExportIfExists = "number";

/** The sample rates on offer. */
export const EXPORT_SAMPLE_RATES: readonly { value: ExportSampleRate; label: string }[] = [
  { value: 44100, label: "44.1 kHz" },
  { value: 48000, label: "48 kHz" },
];

/** The bit depths on offer, for the formats that take one. */
export const EXPORT_BIT_DEPTHS: readonly { value: ExportBitDepth; label: string }[] = [
  { value: 16, label: "16 bit" },
  { value: 24, label: "24 bit" },
];

/** Whether a format takes a bit depth. */
export function hasBitDepth(format: ExportFormat): boolean {
  return format === "wav" || format === "flac";
}

/** The rate a format's file is at: Opus always is 48000, a format with a picture is too. */
export function fileRate(format: ExportFormat, chosen: ExportSampleRate): ExportSampleRate {
  const info = formatInfo(format);
  return info.picture || format === "opus" ? 48000 : chosen;
}

/** A format by its id. */
export function formatInfo(id: ExportFormat): ExportFormatInfo {
  const found = EXPORT_FORMATS.find((format) => format.id === id);
  if (!found) throw new Error(`Unknown format "${id}"`);
  return found;
}

/** The kind a quality value is, `custom` when it's none of the presets. */
export function kindOf(quality: number): ExportKind {
  return EXPORT_KINDS.find((kind) => kind.quality === quality)?.id ?? "custom";
}

/** The quality scale of the page (10–100) as the encoder's numbers. */
export function encoderValues(
  format: ExportFormat,
  quality: number,
): { crf: number; audioKbps: number } {
  const audioKbps =
    format === "mp3" || format === "aac"
      ? 256
      : format === "opus"
        ? 192
        : quality < 50
          ? 128
          : quality < 85
            ? 192
            : 320;
  const h264 = Math.round(36 - quality * 0.2);
  if (format === "h265") return { crf: h264 + 4, audioKbps };
  if (format === "webm") return { crf: Math.round(50 - quality * 0.3), audioKbps };
  return { crf: h264, audioKbps };
}

/** A file name's characters no system allows. */
const FORBIDDEN = /[/\\:*?"<>|]/;

/** Whether a name can be a file name. */
export function validName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && !FORBIDDEN.test(trimmed);
}

/** Joins a folder and a file name with the folder's own separator. */
export function joinPath(folder: string, file: string): string {
  const separator = folder.includes("\\") ? "\\" : "/";
  return `${folder.replace(/[\\/]+$/, "")}${separator}${file}`;
}

/** `name (n).ext`. */
export function numberedName(name: string, extension: string, n: number): string {
  return `${name} (${n}).${extension}`;
}
