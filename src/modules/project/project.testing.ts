import type {
  Clip,
  Junction,
  MediaAsset,
  ProjectFormat,
  ProjectState,
  Track,
} from "./project.types";

/** What a fixture gives: tracks without their composition, which `seedProject` fills in. */
export interface ProjectSeed {
  format?: ProjectFormat;
  tracks?: Record<string, Omit<Track, "compositionId"> & { compositionId?: string }>;
  trackOrder?: string[];
  clips?: Record<string, Clip>;
  junctions?: Record<string, Junction>;
  media?: Record<string, MediaAsset>;
  mediaOrder?: string[];
}

/** A project with one composition `c1` holding the given tracks (else `v1`, `a1`), for test fixtures. */
export function seedProject(seed: ProjectSeed = {}): ProjectState {
  const given = seed.tracks ?? {
    v1: { id: "v1", kind: "video", name: "Video 1", clipIds: [], muted: false, hidden: false },
    a1: { id: "a1", kind: "audio", name: "Audio 1", clipIds: [], muted: false, hidden: false },
  };
  const tracks = Object.fromEntries(
    Object.entries(given).map(([id, track]) => [
      id,
      { ...track, compositionId: track.compositionId ?? "c1" },
    ]),
  );
  return {
    compositions: {
      c1: {
        id: "c1",
        name: "Main",
        format: seed.format ?? { width: 1080, height: 1920, fps: 30 },
        background: "#000000",
        duration: 10_000_000,
        extendToFit: false,
        trackOrder: seed.trackOrder ?? Object.keys(tracks),
      },
    },
    compositionOrder: ["c1"],
    mainCompositionId: "c1",
    media: seed.media ?? {},
    mediaOrder: seed.mediaOrder ?? Object.keys(seed.media ?? {}),
    tracks,
    clips: seed.clips ?? {},
    junctions: seed.junctions ?? {},
  };
}
