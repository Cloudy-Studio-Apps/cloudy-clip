import { defineModule } from "@/core";
import { compositionCommands } from "./composition.commands";
import { compositionMcpTools } from "./composition.mcp";
import { compositionRef } from "./composition.ref";

/** Compositions: their commands and tools. */
export const compositionModule = defineModule({
  ref: compositionRef,
  name: "Compositions",
  tier: "core",
  requires: ["project"],
  commands: compositionCommands,
  mcpTools: compositionMcpTools,
  setup: () => ({ api: {} }),
});
