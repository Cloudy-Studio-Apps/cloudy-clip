import { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef } from "@/modules/project";
import type { RelinkRowsProps } from "@/modules/workspace";
import { Button } from "@/ui";
import { tintRef } from "../tint.ref";
import { usePickLut } from "./lut.pick.hook";

/** The relink dialog's rows for LUT files that couldn't be read, each with Locate. */
export function LutRelinkRows({ onCount }: RelinkRowsProps) {
  const { luts } = useModule(tintRef);
  const { store } = useModule(projectRef);
  const files = useStore(luts.store);
  const all = useStore(store.api, (s) => s.luts);
  const { locate } = usePickLut();
  const missing = useMemo(
    () => Object.values(all ?? {}).filter(({ path }) => files[path]?.status === "missing"),
    [all, files],
  );
  useEffect(() => onCount(missing.length), [missing.length, onCount]);
  return missing.map((lut) => (
    <div key={lut.id} className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm" title={lut.path}>
        {lut.name} <span className="text-muted-foreground">(LUT)</span>
      </span>
      <Button size="sm" onClick={() => void locate(lut)}>
        Locate…
      </Button>
    </div>
  ));
}
