import type { Gradient } from "@/modules/project";
import type {
  CustomProps,
  CustomValues,
  PropertyTree,
  PropsOf,
  PropSpec,
  PropType,
  PropUi,
} from "../element.types";

/** Builders of declared properties. Each returns a `PropSpec` typed with its value. */
export const prop = {
  /** Words. `trim` + `min: 1` refuses blank values. */
  string(o: PropUi & { min?: number; max?: number; multiline?: boolean; trim?: boolean } = {}) {
    return { ...o, kind: "string" } as PropSpec<string>;
  },
  /** A number, optionally in a range, with a unit. */
  number(o: PropUi & { min?: number; max?: number; step?: number; unit?: string } = {}) {
    return { ...o, kind: "number" } as PropSpec<number>;
  },
  /** On or off. */
  boolean(o: PropUi = {}) {
    return { ...o, kind: "boolean" } as PropSpec<boolean>;
  },
  /** A `#rrggbb` color; `opacity` names a sibling 0–1 number edited by the same field. */
  color(o: PropUi & { opacity?: string } = {}) {
    return { ...o, kind: "color" } as PropSpec<string>;
  },
  /** A linear or radial gradient, always written whole. */
  gradient(o: PropUi = {}) {
    return { ...o, kind: "gradient" } as PropSpec<Gradient>;
  },
  /** One of a fixed set of strings. */
  enum<const V extends readonly [string, ...string[]]>(
    values: V,
    o: PropUi & { labels?: Readonly<Record<string, string>> } = {},
  ) {
    return { ...o, kind: "enum", values } as PropSpec<V[number]>;
  },
  /** Fields edited together; `toggle` names the boolean shown in its header. */
  group<F extends PropertyTree>(
    meta: PropUi & { label: string; toggle?: keyof F & string },
    fields: F,
  ) {
    return { ...meta, kind: "group", fields } as PropSpec<PropsOf<F>>;
  },
  /** A value of a registered prop type (a font). */
  custom<N extends keyof CustomProps & keyof CustomValues & string>(
    name: N,
    args: CustomProps[N],
    o: PropUi = {},
  ) {
    return { ...o, kind: "custom", type: name, args } as PropSpec<CustomValues[N]>;
  },
};

/** The control a property uses: its own `control`, else one by value type. */
export function defaultControl(spec: PropSpec, propType?: PropType): string {
  if (spec.control) return spec.control;
  switch (spec.kind) {
    case "string":
      return spec.multiline ? "textarea" : "text";
    case "number":
      return "number";
    case "boolean":
      return "toggle";
    case "color":
      return "color";
    case "gradient":
      return "gradient";
    case "enum":
      return (spec.values?.length ?? 0) <= 4 ? "segmented" : "select";
    case "custom":
      return propType?.control ?? "unknown";
    case "group":
      return "group";
  }
}
