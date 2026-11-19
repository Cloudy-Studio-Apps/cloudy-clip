import { defineSharedGroup, prop } from "@/modules/element";
import { NO_FOLLOW } from "@/modules/project";

/**
 * How a picture follows a motion path, stored at `clip.follow`; missing means it follows none.
 * `pathId` changes only through `path.attach` / `path.detach` (read-only here, so nothing else
 * can make a clip jump). `progress` is where on the path, by distance (keyable; a closed path
 * wraps past 100 %), `orient` adds the path's direction to the rotation. While following,
 * `transform.x` / `transform.y` are an offset from the path. Only for clips on video tracks.
 */
export const followGroup = defineSharedGroup({
  id: "follow",
  key: "follow",
  label: "Follow path",
  order: 910,
  properties: {
    pathId: prop.string({ hidden: true, readOnly: true, label: "Path" }),
    progress: prop.number({
      min: -10,
      max: 10,
      control: "slider",
      ui: { min: 0, max: 1, step: 0.001 },
      display: { scale: 100, unit: "%" },
      label: "Progress",
    }),
    orient: prop.boolean({ label: "Orient along path" }),
  },
  defaults: () => ({ ...NO_FOLLOW }),
  appliesTo: (_clip, track) => track.kind === "video",
  layout: {
    title: "Follow path",
    order: 910,
    tab: "video",
    items: [
      { command: "path.attach", control: "path-picker", label: "Path" },
      "progress",
      "orient",
    ],
  },
});
