import { defineModule } from "@/core";
import { sharedGroups } from "@/modules/element";
import { propertyControls } from "@/modules/inspector";
import { librarySections } from "@/modules/media";
import { createPath, removePaths, updatePath } from "./path.commands";
import { attachPath, detachPath } from "./path.follow.commands";
import { followGroup } from "./path.group";
import { pathMcpTools } from "./path.mcp";
import { pathRef } from "./path.ref";
import { createPathUi } from "./path.store";
import { PathPicker, PathsSection } from "./ui";

/** Motion paths: curves drawn on the frame that picture clips follow over time. */
export const pathModule = defineModule({
  ref: pathRef,
  name: "Paths",
  tier: "feature",
  requires: ["project", "element", "keyframe", "preview", "inspector", "media"],
  commands: [createPath, updatePath, removePaths, attachPath, detachPath],
  mcpTools: pathMcpTools,
  setup(ctx) {
    const ui = createPathUi();
    ctx.contribute(sharedGroups, followGroup);
    ctx.contribute(propertyControls, { id: "path-picker", for: "command", component: PathPicker });
    ctx.contribute(librarySections, { id: "path.section", component: PathsSection });
    return { api: { ui } };
  },
});
