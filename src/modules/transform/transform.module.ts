import { defineModule } from "@/core";
import { previewOverlays } from "@/modules/preview";
import { transformCommands } from "./transform.commands";
import { transformMcpTools } from "./transform.mcp";
import { transformRef } from "./transform.ref";
import { TransformOverlay } from "./ui";

/**
 * Placing pictures in the frame: the `transform.setClipTransform` command (MCP
 * `transform_set_clip_transform`) and the canvas tools that run it (select a picture in the
 * preview, then move, scale or rotate it).
 */
export const transformModule = defineModule({
  ref: transformRef,
  name: "Transform",
  tier: "feature",
  requires: ["project", "media", "preview", "timeline"],
  commands: transformCommands,
  mcpTools: transformMcpTools,
  setup({ contribute }) {
    contribute(previewOverlays, { id: "transform.overlay", component: TransformOverlay });
    return { api: {} };
  },
});
