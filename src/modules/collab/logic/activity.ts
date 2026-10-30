/** How a tool's verb reads while running. */
const RUNNING: Record<string, string> = {
  add: "Adding",
  apply: "Applying",
  capture: "Looking at",
  delete: "Deleting",
  describe: "Reading",
  get: "Reading",
  import: "Importing",
  list: "Reading",
  move: "Moving",
  pause: "Pausing",
  play: "Playing",
  redo: "Redoing",
  remove: "Removing",
  reset: "Resetting",
  seek: "Seeking",
  set: "Setting",
  split: "Splitting",
  trim: "Trimming",
  undo: "Undoing",
  unlink: "Unlinking",
};

/**
 * A sentence for a tool, from its name: `timeline_trim_clip` is "Trimming a clip" while it runs
 * and "Trim clip" once done.
 */
export function activityLabel(tool: string, status: "running" | "done"): string {
  const [module = "", verb = "", ...rest] = tool.split("_");
  const object = rest.join(" ");
  if (status === "done") {
    const text = [verb, object || module].filter(Boolean).join(" ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  const running = RUNNING[verb] ?? `${verb.charAt(0).toUpperCase()}${verb.slice(1)}ing`;
  if (!object) return `${running} ${module}`;
  const single = rest.length === 1 && !object.endsWith("s");
  return `${running} ${single ? "a " : ""}${object}`;
}
