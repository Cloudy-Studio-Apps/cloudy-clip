import { z } from "zod";
import { CommandFailure } from "@/core";
import { MARKER_COLORS, type KeyTrack, type ProjectState } from "@/modules/project";
import type { ProjectEnvelope } from "../workspace.types";

const FORMAT = "cloudy-clip-project";
/** Bump when the document changes shape, and teach `decodeProject` to upgrade the older one. */
const VERSION = 3;
/** What a project without keys is saved as, so an older app still opens it. */
const UNANIMATED_VERSION = 2;

const envelope = z.object({
  format: z.literal(FORMAT),
  version: z.number().int().positive(),
  document: z.unknown(),
});

const size = z.object({ width: z.number(), height: z.number(), fps: z.number() });

// Loose: what's checked is what the policy's `validate` reads. Elements keep their own values.
const documentSchema = z.looseObject({
  description: z.string().optional(),
  compositions: z.record(
    z.string(),
    z.looseObject({
      id: z.string(),
      name: z.string(),
      format: size,
      background: z.string(),
      duration: z.number(),
      extendToFit: z.boolean(),
      trackOrder: z.array(z.string()),
    }),
  ),
  compositionOrder: z.array(z.string()),
  mainCompositionId: z.string().nullable(),
  media: z.record(
    z.string(),
    z.looseObject({
      id: z.string(),
      name: z.string(),
      path: z.string(),
      kind: z.enum(["video", "audio", "image"]),
      size: z.number(),
    }),
  ),
  mediaOrder: z.array(z.string()),
  // Version 1 had no bins or solids: such a file opens with none.
  bins: z
    .record(
      z.string(),
      z.looseObject({ id: z.string(), name: z.string(), parentId: z.string().nullable() }),
    )
    .default({}),
  binOrder: z.array(z.string()).default([]),
  solids: z
    .record(
      z.string(),
      z.looseObject({
        id: z.string(),
        name: z.string(),
        color: z.string(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
    )
    .default({}),
  solidOrder: z.array(z.string()).default([]),
  tracks: z.record(
    z.string(),
    z.looseObject({
      id: z.string(),
      compositionId: z.string(),
      kind: z.enum(["video", "audio"]),
      name: z.string(),
      clipIds: z.array(z.string()),
      muted: z.boolean(),
      hidden: z.boolean(),
    }),
  ),
  clips: z.record(
    z.string(),
    z.looseObject({
      id: z.string(),
      trackId: z.string(),
      kind: z.string(),
      start: z.number(),
      sourceIn: z.number(),
      duration: z.number(),
      props: z.record(z.string(), z.unknown()),
    }),
  ),
  junctions: z.record(
    z.string(),
    z.looseObject({
      id: z.string(),
      kind: z.string(),
      trackId: z.string(),
      leftClipId: z.string(),
      rightClipId: z.string(),
      duration: z.number(),
      props: z.record(z.string(), z.unknown()),
    }),
  ),
  // Files from before markers open with none.
  markers: z
    .record(
      z.string(),
      z.looseObject({
        id: z.string(),
        compositionId: z.string(),
        time: z.number(),
        note: z.string(),
        color: z.enum(MARKER_COLORS),
      }),
    )
    .default({}),
});

/** Whether any clip has keys, which only version 3 knows. */
function isAnimated(document: ProjectState): boolean {
  return Object.values(document.clips).some(
    (clip) => clip.animation && Object.keys(clip.animation).length > 0,
  );
}

/** The document without key tracks that have no keys, which nothing can play. */
function withoutEmptyTracks(document: ProjectState): ProjectState {
  for (const clip of Object.values(document.clips)) {
    if (!clip.animation) continue;
    const kept = Object.entries(clip.animation).filter(
      ([, track]: [string, KeyTrack | undefined]) => (track?.keys?.length ?? 0) > 0,
    );
    if (kept.length > 0) clip.animation = Object.fromEntries(kept);
    else delete clip.animation;
  }
  return document;
}

/**
 * The text of a project file: version 3 when a clip has keys, else version 2, so a project that
 * never used keys opens in an app from before them.
 */
export function encodeProject(document: ProjectState, appVersion: string, now: Date): string {
  const file: ProjectEnvelope = {
    format: FORMAT,
    version: isAnimated(document) ? VERSION : UNANIMATED_VERSION,
    appVersion,
    savedAt: now.toISOString(),
    document,
  };
  return JSON.stringify(file);
}

/**
 * Reads a project file of any version up to 3. Throws `workspace.not_a_project`,
 * `workspace.too_new` or `workspace.damaged`. Key tracks without keys are dropped. The document's
 * rules are checked when it replaces the store.
 */
export function decodeProject(text: string): ProjectState {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new CommandFailure("workspace.not_a_project", "This isn't a Cloudy Clip project.");
  }
  const file = envelope.safeParse(json);
  if (!file.success) {
    throw new CommandFailure("workspace.not_a_project", "This isn't a Cloudy Clip project.");
  }
  if (file.data.version > VERSION) {
    throw new CommandFailure(
      "workspace.too_new",
      "This project was saved by a newer Cloudy Clip. Update the app to open it.",
    );
  }
  const document = documentSchema.safeParse(file.data.document);
  if (!document.success) {
    throw new CommandFailure("workspace.damaged", "This project file is damaged.");
  }
  return withoutEmptyTracks(document.data as unknown as ProjectState);
}
