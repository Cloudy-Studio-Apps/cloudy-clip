import { CommandFailure } from "@/core";
import type { Clip, Track } from "@/modules/project";
import type { ResolvedElement } from "./element.types";
import { leafPaths } from "./logic/paths";

/**
 * A patch of an element's values parsed by its schema (`element.invalid_props` with the Zod
 * message when it doesn't fit), refusing read-only fields (`element.read_only`).
 */
export function parsePatch(
  element: ResolvedElement,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = element.schema.safeParse(patch);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    throw new CommandFailure(
      "element.invalid_props",
      `${element.definition.name}: ${where}${issue.message}`,
    );
  }
  const values = parsed.data as Record<string, unknown>;
  for (const path of leafPaths(values)) {
    if (element.fields.get(path)?.readOnly) {
      throw new CommandFailure("element.read_only", `"${path}" can't be changed`);
    }
  }
  return values;
}

/**
 * Fails (`element.invalid_props`) when the patch names a shared group that doesn't apply to one of
 * the clips on its track (transform on an audio track).
 */
export function checkGroupsApply(
  element: ResolvedElement,
  placed: readonly { clip: Clip; track: Track | undefined }[],
  patch: Record<string, unknown>,
): void {
  for (const group of element.groups) {
    if (patch[group.key] === undefined || !group.appliesTo) continue;
    for (const { clip, track } of placed) {
      if (track && !group.appliesTo(clip, track)) {
        throw new CommandFailure(
          "element.invalid_props",
          `Clip "${clip.id}" has no ${group.label.toLowerCase()} on a ${track.kind} track`,
        );
      }
    }
  }
}

/**
 * Fails when a reset names a path that isn't one of the element's properties or supported groups
 * (`element.invalid_props`), or a read-only one (`element.read_only`).
 */
export function checkResetPaths(element: ResolvedElement, paths: readonly string[]): void {
  for (const path of paths) {
    const isGroup = element.groups.some((g) => g.key === path);
    const spec = element.fields.get(path);
    if (!isGroup && !spec) {
      throw new CommandFailure(
        "element.invalid_props",
        `"${path}" is not a property of ${element.definition.name}`,
      );
    }
    const inner = Object.entries(spec?.fields ?? {});
    if (spec?.readOnly || inner.some(([, field]) => field.readOnly)) {
      throw new CommandFailure("element.read_only", `"${path}" can't be changed`);
    }
  }
}
