import { useStore } from "zustand";
import { useModule } from "@/core";
import type { Clip } from "@/modules/project";
import type { TextStylePatch } from "../text.types";
import { ColorField } from "@/ui";
import { textRef } from "../text.ref";
import { useTextLive } from "./text.live.hook";

/** The quick colors of the prototype's text tab. */
const SWATCHES = ["#ffffff", "#1f2430", "#f2a385", "#8cc4f0", "#f5d97a", "#b9a3f0"];

interface StyleColorProps {
  clip: Clip;
  label: string;
  color: string;
  /** Given for fills that have an opacity. */
  opacity?: number;
  /** The style patch for a color (and opacity, which is the current one when the field has none). */
  toPatch(color: string, opacity: number): TextStylePatch;
}

/** A color field on the style: drags show live, a release, typed hex or swatch commits once and is remembered. */
export function StyleColor({ clip, label, color, opacity, toPatch }: StyleColorProps) {
  const live = useTextLive(clip);
  const recents = useModule(textRef).recents;
  const colors = useStore(recents.store, (s) => s.colors);
  return (
    <ColorField
      label={label}
      color={color}
      opacity={opacity}
      swatches={SWATCHES}
      recents={colors}
      onChange={(next, alpha, info) => {
        if (!info.done) return live.input(toPatch(next, alpha));
        live.commit(toPatch(next, alpha));
        recents.push(next);
      }}
    />
  );
}
