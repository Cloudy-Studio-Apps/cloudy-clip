import { Square } from "lucide-react";
import { defineModule } from "@/core";
import { elements } from "@/modules/element";
import { libraryKinds } from "@/modules/media";
import { solidCommands } from "./solid.commands";
import { solidElement } from "./solid.element";
import { solidMcpTools } from "./solid.mcp";
import { solidRef } from "./solid.ref";
import { SolidButton, SolidTile, useSolidEntries } from "./ui";

/** Solid colors: the element, library items with their own smart bin, and the dialog. */
export const solidModule = defineModule({
  ref: solidRef,
  name: "Solid colors",
  tier: "feature",
  requires: ["project", "element", "media", "transform"],
  commands: solidCommands,
  mcpTools: solidMcpTools,
  setup({ contribute }) {
    contribute(elements, solidElement);
    contribute(libraryKinds, {
      type: "solid",
      label: "Solid colors",
      icon: Square,
      useEntries: useSolidEntries,
      Tile: SolidTile,
      CreateButton: SolidButton,
    });
    return { api: {} };
  },
});
