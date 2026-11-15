import type { DeliverySettings, StandardId } from "@/modules/project";
import type { Standard } from "../sound.delivery.types";

/**
 * The delivery standards, as data. Each figure is checked against the page it cites (read
 * 2026-11-09); where a platform publishes no figure the entry says so, and the figure is a common
 * convention, not the platform's word. Platforms change these: re-check the page before editing.
 */
export const STANDARDS: readonly Standard[] = [
  {
    id: "youtube",
    name: "YouTube",
    loudnessLufs: -14,
    peakDbtp: -1,
    // YouTube's help pages publish no loudness target or peak limit (searched 2026-11-09). -14 LUFS and -1 dBTP are the
    // common convention for YouTube masters (the same as Spotify's published figures).
    published: false,
    source: null,
  },
  {
    id: "spotify",
    name: "Spotify",
    loudnessLufs: -14,
    peakDbtp: -1,
    // "-14 dB LUFS" integrated, true peak "below -1dB TP", or below -2 dB TP when louder than
    // -14 LUFS (we use -1, the figure for the target itself).
    published: true,
    source: "https://support.spotify.com/us/artists/article/loudness-normalization/",
  },
  {
    id: "applePodcasts",
    name: "Apple Podcasts",
    loudnessLufs: -16,
    peakDbtp: -1,
    // "around -16 dB LKFS, with a +/- 1 dB tolerance"; true peak "should not exceed -1 dB FS"
    // (ITU-R BS.1770-5; LKFS and LUFS are the same unit).
    published: true,
    source: "https://podcasters.apple.com/support/893-audio-requirements",
  },
  {
    id: "tiktok",
    name: "TikTok",
    loudnessLufs: -14,
    peakDbtp: -1,
    // TikTok publishes no loudness target or peak limit that we could find (searched 2026-11-09). -14 LUFS and -1 dBTP
    // are the common convention for short-form social video.
    published: false,
    source: null,
  },
  {
    id: "ebuR128",
    name: "EBU R128",
    loudnessLufs: -23,
    peakDbtp: -1,
    // "an average programme loudness of -23 LUFS"; "the True Peak Level of a programme shall not
    // exceed -1 dBTP". Version 5.0, November 2023.
    published: true,
    source: "https://tech.ebu.ch/publications/r128",
  },
  {
    id: "atscA85",
    name: "ATSC A/85",
    loudnessLufs: -24,
    peakDbtp: -2,
    // Annex M (Loudness and True Peak Quick Reference), A/85:2026-07: "the Target Loudness
    // should be -24 LKFS" for content without metadata, maximum true peak -2 dBTP.
    published: true,
    source: "https://www.atsc.org/wp-content/uploads/2026/07/A85-2026-07.pdf",
  },
  {
    id: "custom",
    name: "Custom",
    loudnessLufs: -14,
    peakDbtp: -1,
    // The user's own figures; these are where Custom starts.
    published: false,
    source: null,
  },
];

/** What a composition without a choice is delivered against. */
export const DEFAULT_STANDARD: StandardId = "youtube";

/** The standard with this id. */
export function standardOf(id: StandardId): Standard {
  return STANDARDS.find((s) => s.id === id)!;
}

/** The delivery settings of a standard, with its own figures. */
export function settingsOf(id: StandardId): DeliverySettings {
  const { loudnessLufs, peakDbtp } = standardOf(id);
  return { standard: id, loudnessLufs, peakDbtp };
}

/** What a composition is delivered against: its choice, or the default standard's. */
export function deliveryOf(mix: { delivery?: DeliverySettings }): DeliverySettings {
  return mix.delivery ?? settingsOf(DEFAULT_STANDARD);
}
