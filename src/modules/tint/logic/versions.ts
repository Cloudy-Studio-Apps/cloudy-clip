import { CommandFailure } from "@/core";
import type { Clip, StoredGradeVersion } from "@/modules/project";
import type { VersionAction } from "../tint.types";

/** The name of a clip's active version when it has none stored. */
export const DEFAULT_VERSION = "A";

/** Name of a clip's active version. */
export const activeVersion = (clip: Clip): string => clip.gradeVersion ?? DEFAULT_VERSION;

/** Every version name of a clip, the active one first. */
export const versionNames = (clip: Clip): string[] => [
  activeVersion(clip),
  ...Object.keys(clip.gradeVersions ?? {}),
];

/** A deep copy that also reads an immer draft (`structuredClone` throws on a proxy); grades are plain JSON. */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The clip's `grade.*` key tracks, as a copy. Undefined when it has none. */
function gradeTracks(clip: Clip): StoredGradeVersion["animation"] {
  const entries = Object.entries(clip.animation ?? {}).filter(([path]) =>
    path.startsWith("grade."),
  );
  return entries.length > 0 ? copy(Object.fromEntries(entries)) : undefined;
}

/** What the clip's active version holds now, as a stored version. */
function snapshot(clip: Clip): StoredGradeVersion {
  const animation = gradeTracks(clip);
  return {
    ...(clip.grade && { grade: copy(clip.grade) }),
    ...(animation && { animation }),
  };
}

/** Puts `stored` in as the clip's active grade and `grade.*` tracks, replacing what was there. */
function bringOut(clip: Clip, stored: StoredGradeVersion): void {
  const kept = Object.entries(clip.animation ?? {}).filter(([path]) => !path.startsWith("grade."));
  const animation = { ...Object.fromEntries(kept), ...stored.animation };
  if (stored.grade) clip.grade = stored.grade;
  else delete clip.grade;
  if (Object.keys(animation).length > 0) clip.animation = animation;
  else delete clip.animation;
}

/**
 * Changes a clip's versions in place (a draft or a copy) and says whether anything changed. The
 * active version's grade and `grade.*` tracks are the clip's own `grade` and `animation`; the
 * others sit in `gradeVersions`, so a switch swaps the two in one write. Deleting the active
 * version is refused. Throws `tint.version_not_found`, `tint.version_exists` or
 * `tint.version_active`; nothing is written when it throws.
 */
export function changeVersions(
  clip: Clip,
  action: VersionAction,
  name: string,
  to?: string,
): boolean {
  const active = activeVersion(clip);
  const names = versionNames(clip);
  const missing = () =>
    new CommandFailure("tint.version_not_found", `No version "${name}" on clip "${clip.id}"`, {
      clipId: clip.id,
      name,
    });
  const exists = (taken: string) =>
    new CommandFailure(
      "tint.version_exists",
      `Clip "${clip.id}" already has a version "${taken}"`,
      {
        clipId: clip.id,
        name: taken,
      },
    );
  const stored = { ...clip.gradeVersions };
  if (action === "create") {
    if (names.includes(name)) throw exists(name);
    stored[name] = snapshot(clip);
  } else if (!names.includes(name)) {
    throw missing();
  } else if (action === "switch") {
    if (name === active) return false;
    stored[active] = snapshot(clip);
    bringOut(clip, stored[name]!);
    delete stored[name];
    if (name === DEFAULT_VERSION) delete clip.gradeVersion;
    else clip.gradeVersion = name;
  } else if (action === "rename") {
    if (to === undefined || to === name) return false;
    if (names.includes(to)) throw exists(to);
    if (name === active) clip.gradeVersion = to;
    else {
      stored[to] = stored[name]!;
      delete stored[name];
    }
    if (clip.gradeVersion === DEFAULT_VERSION) delete clip.gradeVersion;
  } else {
    if (name === active) {
      throw new CommandFailure(
        "tint.version_active",
        `Version "${name}" is the one showing; switch to another before deleting it.`,
        { clipId: clip.id, name },
      );
    }
    delete stored[name];
  }
  if (Object.keys(stored).length > 0) clip.gradeVersions = stored;
  else delete clip.gradeVersions;
  return true;
}
