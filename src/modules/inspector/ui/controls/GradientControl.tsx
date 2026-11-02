import { useStore } from "zustand";
import { useModule } from "@/core";
import { GradientField, type GradientValue } from "@/ui";
import type { FieldControlProps } from "../../inspector.types";
import { inspectorRef } from "../../inspector.ref";
import { pathPatch } from "../../logic/paths";
import { FieldRow } from "./FieldRow";

/** Quick colors offered for a stop. */
const SWATCHES = ["#ffffff", "#1f2430", "#f2a385", "#8cc4f0", "#f5d97a", "#b9a3f0"];

/**
 * A gradient: drags show live; a release commits once, and a changed stop's color is remembered in
 * the recent colors.
 */
export function GradientControl({ path, value, label, live, disabled }: FieldControlProps) {
  const recents = useModule(inspectorRef).recents;
  const colors = useStore(recents.store, (s) => s.colors);
  const gradient = value as GradientValue;
  return (
    <FieldRow label={label}>
      <GradientField
        label={label}
        value={gradient}
        disabled={disabled}
        swatches={SWATCHES}
        recents={colors}
        onChange={(next, info) => {
          const patch = pathPatch(path, next);
          if (!info.done) return live.input(patch);
          live.commit(patch);
          const changed = next.stops.find((s, i) => s.color !== gradient.stops[i]?.color);
          if (changed) recents.push(changed.color);
        }}
      />
    </FieldRow>
  );
}
