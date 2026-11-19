import { z } from "zod";
import { CommandFailure, createLogger } from "@/core";
import {
  gradeSchema,
  MARKER_COLORS,
  validateGrade,
  type ClipGrade,
  type KeyTrack,
  type ProjectState,
} from "@/modules/project";
import type { ProjectEnvelope } from "../workspace.types";

const FORMAT = "cloudy-clip-project";
/** Bump when the document changes shape, and teach `decodeProject` to upgrade the older one. */
const VERSION = 5;
/** What a project with grades but no motion paths is saved as, so an older app still opens it. */
const GRADED_VERSION = 4;
/** What a project with keys but no grades is saved as, so an older app still opens it. */
const ANIMATED_VERSION = 3;
/** What a project without keys or grades is saved as, so an older app still opens it. */
const UNANIMATED_VERSION = 2;

const log = createLogger("workspace");

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
  // Files from before paths open with none.
  paths: z
    .record(
      z.string(),
      z.looseObject({
        id: z.string(),
        compositionId: z.string(),
        name: z.string(),
        closed: z.boolean(),
        points: z
          .array(
            z.looseObject({
              x: z.number(),
              y: z.number(),
              inX: z.number(),
              inY: z.number(),
              outX: z.number(),
              outY: z.number(),
            }),
          )
          .min(2),
      }),
    )
    .optional(),
});

/** Whether the document has motion paths or a clip following one, which only version 5 knows. */
function usesPaths(document: ProjectState): boolean {
  return (
    Object.keys(document.paths ?? {}).length > 0 ||
    Object.values(document.clips).some((clip) => clip.follow)
  );
}

/** Whether any clip has keys, which only version 3 knows. */
function isAnimated(document: ProjectState): boolean {
  return Object.values(document.clips).some(
    (clip) => clip.animation && Object.keys(clip.animation).length > 0,
  );
}

/** Whether the document uses grade data, which only version 4 knows. */
function usesGrades(document: ProjectState): boolean {
  const filled = (record: object | undefined) => !!record && Object.keys(record).length > 0;
  return (
    Object.values(document.clips).some(
      (clip) => clip.grade || clip.gradeVersions || clip.gradeVersion || clip.gradeGroup,
    ) ||
    Object.values(document.compositions).some((composition) => composition.grade) ||
    filled(document.gradeGroups) ||
    filled(document.luts) ||
    filled(document.stills)
  );
}

/** `holder.grade` when it passes `gradeSchema` and `validateGrade`; else it is dropped with a warning. */
function checkGrade(holder: { grade?: ClipGrade }, where: string): void {
  if (holder.grade === undefined) return;
  const result = gradeSchema.safeParse(holder.grade);
  const problem = result.success ? validateGrade(holder.grade) : result.error.issues[0];
  if (!problem) return;
  log.warn(`Dropped a broken grade on ${where}.`, problem);
  delete holder.grade;
}

/** Every grade in the document checked; a broken one is dropped and the file still opens. */
function withValidGrades(document: ProjectState): ProjectState {
  for (const clip of Object.values(document.clips)) {
    checkGrade(clip, `clip ${clip.id}`);
    for (const [name, stored] of Object.entries(clip.gradeVersions ?? {})) {
      checkGrade(stored, `version "${name}" of clip ${clip.id}`);
    }
  }
  for (const composition of Object.values(document.compositions)) {
    checkGrade(composition, `composition ${composition.id}`);
  }
  for (const group of Object.values(document.gradeGroups ?? {})) {
    checkGrade(group, `group ${group.id}`);
  }
  for (const still of Object.values(document.stills ?? {})) {
    checkGrade(still, `still ${still.id}`);
  }
  return document;
}

/**
 * The document without follows it can't play: a clip following a missing path, or a path of
 * another composition, stops following (and loses its Progress keys) with a warning.
 */
function withValidFollows(document: ProjectState): ProjectState {
  for (const clip of Object.values(document.clips)) {
    if (!clip.follow) continue;
    const path = document.paths?.[clip.follow.pathId];
    const home = document.tracks[clip.trackId]?.compositionId;
    if (path && path.compositionId === home) continue;
    log.warn(`Clip ${clip.id} followed a path it can't; it no longer follows one.`);
    delete clip.follow;
    if (!clip.animation) continue;
    for (const key of Object.keys(clip.animation)) {
      if (key.startsWith("follow.")) delete clip.animation[key];
    }
    if (Object.keys(clip.animation).length === 0) delete clip.animation;
  }
  return document;
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
 * The text of a project file: version 5 when it uses motion paths, else 4 when it uses grades, else version 3 when a clip has keys,
 * else version 2, so a project that never used them opens in an app from before them.
 */
export function encodeProject(document: ProjectState, appVersion: string, now: Date): string {
  const file: ProjectEnvelope = {
    format: FORMAT,
    version: usesPaths(document)
      ? VERSION
      : usesGrades(document)
        ? GRADED_VERSION
        : isAnimated(document)
          ? ANIMATED_VERSION
          : UNANIMATED_VERSION,
    appVersion,
    savedAt: now.toISOString(),
    document,
  };
  return JSON.stringify(file);
}

/**
 * Reads a project file of any version up to 5. Throws `workspace.not_a_project`,
 * `workspace.too_new` or `workspace.damaged`. Key tracks without keys are dropped, and so is a grade that fails `gradeSchema` and a follow whose path is missing or in another composition (with a warning). The document's
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
  return withValidFollows(
    withValidGrades(withoutEmptyTracks(document.data as unknown as ProjectState)),
  );
}
