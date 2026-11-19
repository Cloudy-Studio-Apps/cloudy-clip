import { defineModule } from "@/core";
import { keyTargets } from "@/modules/keyframe";
import { addMask, removeMasks, reorderMask, updateMask } from "./mask.commands";
import { setMatte } from "./mask.matte.commands";
import { maskKeys } from "./mask.keys";
import { maskMcpTools } from "./mask.mcp";
import { convertMask, setPoints } from "./mask.points.commands";
import { maskRef } from "./mask.ref";
import { createMaskUi } from "./mask.store";

/** Masks on picture clips and track mattes. */
export const maskModule = defineModule({
  ref: maskRef,
  name: "Masks",
  tier: "feature",
  requires: ["project", "element", "preview", "keyframe"],
  commands: [addMask, updateMask, removeMasks, reorderMask, setMatte, setPoints, convertMask],
  mcpTools: maskMcpTools,
  setup(ctx) {
    ctx.contribute(keyTargets, maskKeys);
    return { api: { ui: createMaskUi() } };
  },
});
