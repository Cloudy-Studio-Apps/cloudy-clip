import { describe, expect, it } from "vitest";
import { Type } from "lucide-react";
import {
  defaultControl,
  patchSchema,
  resolveLayout,
  type PropSpec,
  type ResolvedElement,
  type SharedGroup,
} from "@/modules/element";
import { textElement } from "./text.element";

const transform: SharedGroup = {
  id: "transform",
  key: "transform",
  label: "Transform",
  order: 900,
  properties: { x: { kind: "number" }, y: { kind: "number" } },
  defaults: () => ({ x: 0, y: 0 }),
};

function resolved(): ResolvedElement {
  const fields = new Map<string, PropSpec>();
  for (const [name, spec] of Object.entries(textElement.properties)) {
    fields.set(name, spec);
    for (const [inner, s] of Object.entries(spec.fields ?? {})) fields.set(`${name}.${inner}`, s);
  }
  fields.set("transform.x", { kind: "number" });
  fields.set("transform.y", { kind: "number" });
  return {
    definition: textElement as unknown as ResolvedElement["definition"],
    groups: [transform],
    fields,
    schema: patchSchema(textElement.properties, { propType: () => undefined, groups: [] }),
  };
}

describe("text panel layout", () => {
  it("has the six text sections then Transform, with the groups' toggles in the headers", () => {
    const { sections, issues } = resolveLayout(resolved(), (_p, spec) => defaultControl(spec));
    expect(sections.map((s) => s.title)).toEqual([
      "Content",
      "Font",
      "Fill",
      "Outline",
      "Background",
      "Shadow",
      "Transform",
    ]);
    expect(sections.map((s) => s.header)).toEqual([
      undefined,
      undefined,
      undefined,
      "outline.enabled",
      "background.enabled",
      "shadow.enabled",
      undefined,
    ]);
    expect(issues).toEqual([]);
  });
  it("places the preset row and the Spacing sub-section", () => {
    const { sections } = resolveLayout(resolved(), (_p, spec) => defaultControl(spec));
    expect(sections[0]!.items[1]).toMatchObject({
      type: "command",
      id: "text.applyPreset",
      control: "preset-row",
    });
    expect(sections[1]!.items.some((i) => i.type === "sub" && i.title === "Spacing")).toBe(true);
  });
  it("is the element's own display", () => {
    expect(textElement.display({ ...clip, props: { text: "Hi" } }, env).label).toBe("Hi");
    expect(textElement.display(clip, env).icon).toBe(Type);
  });
});

const clip = { id: "t", trackId: "v", kind: "text", props: {}, start: 0, sourceIn: 0, duration: 1 };
const env = { project: null!, track: undefined };
