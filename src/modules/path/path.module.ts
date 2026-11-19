import { defineModule } from "@/core";
import { sharedGroups } from "@/modules/element";
import { createPath, removePaths, updatePath } from "./path.commands";
import { attachPath, detachPath } from "./path.follow.commands";
import { followGroup } from "./path.group";
import { pathMcpTools } from "./path.mcp";
import { pathRef } from "./path.ref";

/** Motion paths: curves drawn on the frame that picture clips follow over time. */
export const pathModule = defineModule({
  ref: pathRef,
  name: "Paths",
  tier: "feature",
  requires: ["project", "element", "keyframe", "preview"],
  commands: [createPath, updatePath, removePaths, attachPath, detachPath],
  mcpTools: pathMcpTools,
  setup(ctx) {
    ctx.contribute(sharedGroups, followGroup);
    return { api: {} };
  },
});
