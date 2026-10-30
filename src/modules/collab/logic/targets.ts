import type { FieldChange, StoreChange } from "@/core";
import type { CollabTarget } from "../collab.types";

const TIMELINE = "panel:timeline.panel";
const PREVIEW = "panel:preview.panel";
const MEDIA = "panel:media.library";
const INSPECTOR = "panel:inspector.panel";

/** What a field of the project is shown on. The inspector shows the user's selection only. */
function fieldTarget({ path }: FieldChange, selection: readonly string[]): CollabTarget {
  const [collection, id = "", field] = path;
  if (collection === "media") return `media:${id}`;
  if (collection === "format") return PREVIEW;
  if (collection !== "clips") return TIMELINE;
  if (!selection.includes(id)) return `clip:${id}`;
  if (field === "transform") return "inspector:transform";
  return field === "props" ? INSPECTOR : `clip:${id}`;
}

/** What a command changed, as a place on screen. */
export function changesTarget(
  changes: readonly StoreChange[],
  selection: readonly string[],
): CollabTarget | null {
  const first = changes.flatMap((change) => change.fields ?? [])[0];
  return first ? fieldTarget(first, selection) : null;
}

/** Where a tool works before anything changes. Reading the project goes nowhere. */
export function toolTarget(tool: string): CollabTarget | null {
  if (tool.startsWith("preview_")) return PREVIEW;
  if (tool.startsWith("media_")) return MEDIA;
  return null;
}
