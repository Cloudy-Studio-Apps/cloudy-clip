import { useMemo } from "react";
import { useKernel } from "@/core";
import type { Lut } from "@/modules/project";
import { importLut, relinkLut } from "../tint.color.commands";
import { askLutFile } from "../tint.service";
import { settle } from "./settle";

/**
 * The LUT file pickers, ready to call from a component: `pick` asks for a `.cube` file and imports
 * it (`tint.importLut`), giving its id (null when cancelled or refused); `locate` asks where a
 * missing one went and relinks it (`tint.relinkLut`). A refusal is shown to the user.
 */
export function usePickLut(): {
  pick(): Promise<string | null>;
  locate(lut: Lut): Promise<void>;
} {
  const { bus } = useKernel();
  return useMemo(
    () => ({
      async pick() {
        const path = await askLutFile("Import a .cube LUT");
        if (!path) return null;
        const result = await settle(bus.run(importLut, { path }));
        return result.ok ? result.value.lutId : null;
      },
      async locate(lut) {
        const path = await askLutFile(`Locate ${lut.name}`);
        if (path) await settle(bus.run(relinkLut, { lutId: lut.id, path }));
      },
    }),
    [bus],
  );
}
