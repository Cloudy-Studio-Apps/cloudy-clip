import { defaultControl, resolveLayout, type LayoutSource, type PropType } from "@/modules/element";

/** A subject's panel, each field with the control it uses by default. */
export function panelLayout(source: LayoutSource, types: readonly PropType[]) {
  return resolveLayout(source, (_path, spec) =>
    defaultControl(spec, spec.type ? types.find((t) => t.name === spec.type) : undefined),
  );
}
