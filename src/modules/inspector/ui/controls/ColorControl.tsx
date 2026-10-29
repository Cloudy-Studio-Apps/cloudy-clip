import { useStore } from "zustand";
import { useModule } from "@/core";
import { getPath, mergeProps } from "@/modules/element";
import { ColorField } from "@/ui";
import type { FieldControlProps } from "../../inspector.types";
import { inspectorRef } from "../../inspector.ref";
import { pathPatch } from "../../logic/paths";

/** Quick colors offered by every color field. */
const SWATCHES = ["#ffffff", "#1f2430", "#f2a385", "#8cc4f0", "#f5d97a", "#b9a3f0"];

/**
 * A color (and its sibling opacity, when the spec names one): drags show live; a release, typed
 * hex or swatch commits once and is remembered in the recent colors.
 */
export function ColorControl({
  path,
  spec,
  value,
  values,
  label,
  live,
  disabled,
}: FieldControlProps) {
  const recents = useModule(inspectorRef).recents;
  const colors = useStore(recents.store, (s) => s.colors);
  const parent = path.includes(".") ? path.slice(0, path.lastIndexOf(".") + 1) : "";
  const opacityPath = spec.opacity ? parent + spec.opacity : undefined;
  const opacity = opacityPath ? Number(getPath(values, opacityPath) ?? 1) : undefined;
  return (
    <ColorField
      label={label}
      color={typeof value === "string" ? value : "#000000"}
      opacity={opacity}
      disabled={disabled}
      swatches={SWATCHES}
      recents={colors}
      onChange={(color, alpha, info) => {
        const patch = opacityPath
          ? mergeProps(pathPatch(path, color), pathPatch(opacityPath, alpha))
          : pathPatch(path, color);
        if (!info.done) return live.input(patch);
        live.commit(patch);
        recents.push(color);
      }}
    />
  );
}
