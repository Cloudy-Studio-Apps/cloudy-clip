import { defineModule } from "@/core";
import { addMask, removeMasks, reorderMask, updateMask } from "./mask.commands";
import { setMatte } from "./mask.matte.commands";
import { maskMcpTools } from "./mask.mcp";
import { maskRef } from "./mask.ref";
import { createMaskUi } from "./mask.store";

/** Masks on picture clips and track mattes. */
export const maskModule = defineModule({
  ref: maskRef,
  name: "Masks",
  tier: "feature",
  requires: ["project", "element", "preview"],
  commands: [addMask, updateMask, removeMasks, reorderMask, setMatte],
  mcpTools: maskMcpTools,
  setup() {
    return { api: { ui: createMaskUi() } };
  },
});
