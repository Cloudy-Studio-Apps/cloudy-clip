import { SquareDashed } from "lucide-react";
import { defineModule } from "@/core";
import { inspectorSections, inspectorTabs } from "@/modules/inspector";
import { keyTargets } from "@/modules/keyframe";
import { addMask, removeMasks, reorderMask, updateMask } from "./mask.commands";
import { setMatte } from "./mask.matte.commands";
import { maskKeys } from "./mask.keys";
import { maskMcpTools } from "./mask.mcp";
import { convertMask, setPoints } from "./mask.points.commands";
import { maskRef } from "./mask.ref";
import { createMaskUi } from "./mask.store";
import { maskSections } from "./ui";

/** Masks on picture clips and track mattes. */
export const maskModule = defineModule({
  ref: maskRef,
  name: "Masks",
  tier: "feature",
  requires: ["project", "element", "preview", "keyframe", "inspector", "timeline", "transform"],
  commands: [addMask, updateMask, removeMasks, reorderMask, setMatte, setPoints, convertMask],
  mcpTools: maskMcpTools,
  setup(ctx) {
    ctx.contribute(keyTargets, maskKeys);
    ctx.contribute(inspectorTabs, { id: "mask", label: "Mask", icon: SquareDashed, order: 150 });
    ctx.contribute(inspectorSections, ...maskSections);
    return { api: { ui: createMaskUi() } };
  },
});
