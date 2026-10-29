import { defineModule } from "@/core";
import { sharedGroups } from "@/modules/element";
import { previewOverlays } from "@/modules/preview";
import { transformCommands } from "./transform.commands";
import { transformGroup } from "./transform.group";
import { transformMcpTools } from "./transform.mcp";
import { transformRef } from "./transform.ref";
import { TransformOverlay } from "./ui";

/**
 * Placing pictures in the frame: the `transform` shared group (edited with `element.setProps`),
 * `transform.reset` (MCP `transform_reset`) and the canvas tools (select a picture in the
 * preview, then move, scale or rotate it).
 */
export const transformModule = defineModule({
  ref: transformRef,
  name: "Transform",
  tier: "feature",
  requires: ["project", "element", "media", "fonts", "preview", "timeline"],
  commands: transformCommands,
  mcpTools: transformMcpTools,
  setup({ contribute }) {
    contribute(sharedGroups, transformGroup);
    contribute(previewOverlays, { id: "transform.overlay", component: TransformOverlay });
    return { api: {} };
  },
});
