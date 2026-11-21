import type { ProjectFormat } from "@/modules/project";
import type { MaskRowSpec } from "../mask.types";

const pct = { min: 0, max: 100, step: 1, unit: "%", show: 100 } as const;

/** The rows of a mask's fields by its shape kind, with ranges sized to the frame. */
export function maskRows(kind: string, format: ProjectFormat): MaskRowSpec[] {
  const { width: w, height: h } = format;
  const own = (name: string) => ({ name, min: 0, max: 0, step: 1 });
  const position: MaskRowSpec = {
    label: "Position",
    fields: [
      { ...own("x"), min: -w, max: w, unit: "px" },
      { ...own("y"), min: -h, max: h, unit: "px" },
    ],
  };
  const size = (shape: boolean): MaskRowSpec["fields"] => [
    { name: "width", shape: true, min: 1, max: w * 2, step: 1, unit: "px" },
    ...(shape
      ? [{ name: "height", shape: true as const, min: 1, max: h * 2, step: 1, unit: "px" }]
      : []),
  ];
  const rows: MaskRowSpec[] = [position];
  if (["rectangle", "ellipse", "star", "heart"].includes(kind))
    rows.push({ label: "Size", fields: size(true) });
  if (kind === "mirror") rows.push({ label: "Width", fields: size(false) });
  rows.push({
    label: "Rotation",
    fields: [{ ...own("rotation"), min: -180, max: 180, unit: "°" }],
  });
  if (kind === "rectangle")
    rows.push({ label: "Roundness", fields: [{ name: "roundness", shape: true, ...pct }] });
  if (kind === "star") {
    rows.push({
      label: "Points",
      fields: [{ name: "points", shape: true, min: 3, max: 24, step: 1 }],
    });
    rows.push({
      label: "Inner",
      fields: [{ name: "inner", shape: true, ...pct, min: 5 }],
    });
  }
  if (kind === "path")
    rows.push({
      label: "Scale",
      fields: [{ name: "scale", shape: true, min: 0.01, max: 20, step: 0.01, unit: "x" }],
    });
  rows.push(
    { label: "Feather", fields: [{ ...own("feather"), max: 500, unit: "px" }] },
    { label: "Expansion", fields: [{ ...own("expansion"), min: -500, max: 500, unit: "px" }] },
    { label: "Opacity", fields: [{ name: "opacity", ...pct }] },
  );
  return rows;
}
