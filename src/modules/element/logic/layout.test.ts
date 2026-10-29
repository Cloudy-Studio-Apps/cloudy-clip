import { describe, expect, it } from "vitest";
import { Type } from "lucide-react";
import type { LayoutSection, PropSpec, ResolvedElement, SharedGroup } from "../element.types";
import { resolveLayout } from "./layout";
import { defaultControl, prop } from "./props";

const properties = {
  text: prop.string(),
  size: prop.number(),
  secret: prop.number({ hidden: true }),
  letterSpacing: prop.number({ control: "slider" }),
  box: prop.group(
    { label: "Box", toggle: "on" },
    { on: prop.boolean(), pad: prop.number(), radius: prop.number() },
  ),
};
const transform: SharedGroup = {
  id: "transform",
  key: "transform",
  label: "Transform",
  order: 900,
  properties: { x: prop.number(), y: prop.number() },
  defaults: () => ({ x: 0, y: 0 }),
};

function element(
  layout?: LayoutSection[],
  groups: SharedGroup[] = [transform],
  props: Record<string, PropSpec> = properties,
): ResolvedElement {
  const fields = new Map<string, PropSpec>();
  for (const [name, spec] of Object.entries(props)) {
    fields.set(name, spec);
    for (const [inner, s] of Object.entries(spec.fields ?? {})) fields.set(`${name}.${inner}`, s);
  }
  for (const g of groups)
    for (const [n, s] of Object.entries(g.properties)) fields.set(`${g.key}.${n}`, s);
  return {
    definition: {
      kind: "note",
      name: "Note",
      source: "none",
      tracks: ["video"],
      properties: props,
      ...(layout && { layout }),
      defaults: () => ({}),
      display: () => ({ icon: Type, color: "clip-type", label: "", body: "none" }),
    },
    groups,
    fields,
    schema: null!,
  };
}
const controlOf = (_path: string, spec: PropSpec) => defaultControl(spec);
const titles = (layout?: LayoutSection[]) =>
  resolveLayout(element(layout), controlOf).sections.map((s) => s.title);

describe("resolveLayout without a layout", () => {
  it("has General, one section per group, then the shared groups", () => {
    const { sections, issues } = resolveLayout(element(), controlOf);
    expect(sections.map((s) => [s.title, s.header])).toEqual([
      ["General", undefined],
      ["Box", "box.on"],
      ["Transform", undefined],
    ]);
    expect(issues).toEqual([]);
  });
  it("skips hidden fields and labels camelCase names", () => {
    const general = resolveLayout(element(), controlOf).sections[0]!;
    expect(general.items).toEqual([
      { type: "field", path: "text", control: "text", label: "Text" },
      { type: "field", path: "size", control: "number", label: "Size" },
      { type: "field", path: "letterSpacing", control: "slider", label: "Letter spacing" },
    ]);
  });
  it("lists a group's fields without its toggle", () => {
    const box = resolveLayout(element(), controlOf).sections[1]!;
    expect(box.items.map((i) => i.type === "field" && i.path)).toEqual(["box.pad", "box.radius"]);
  });
});

describe("resolveLayout with a layout", () => {
  const all: LayoutSection[] = [{ title: "All", items: ["text", "size", "letterSpacing", "box"] }];

  it("lets a group alone in a section take it over", () => {
    const { sections } = resolveLayout(
      element([{ items: ["text", "size", "letterSpacing"] }, { items: ["box"] }]),
      controlOf,
    );
    expect(sections[1]).toMatchObject({ title: "Box", header: "box.on" });
    expect(sections[1]!.items).toHaveLength(2);
  });
  it("makes a group next to other items a sub-section", () => {
    const { sections } = resolveLayout(element(all), controlOf);
    expect(sections[0]!.items[3]).toMatchObject({ type: "sub", title: "Box", header: "box.on" });
  });
  it("shows only the listed fields of { group, items }", () => {
    const { sections } = resolveLayout(
      element([
        {
          title: "All",
          items: ["text", "size", "letterSpacing", { group: "box", items: ["pad"] }],
        },
      ]),
      controlOf,
    );
    const sub = sections[0]!.items[3]!;
    expect(sub).toMatchObject({ type: "sub", title: "Box", header: "box.on" });
    expect(sub.type === "sub" && sub.items.map((i) => i.type === "field" && i.path)).toEqual([
      "box.pad",
    ]);
  });
  it("puts rows, explicit sub-sections, overrides and commands in order", () => {
    const { sections } = resolveLayout(
      element([
        {
          title: "Main",
          items: [
            { row: ["text", "size"] },
            { title: "Spacing", items: [{ path: "letterSpacing", control: "dial", label: "Gap" }] },
            { command: "element.resetProps", label: "Reset" },
          ],
        },
        { items: ["box"] },
      ]),
      controlOf,
    );
    expect(sections[0]!.items.map((i) => i.type)).toEqual(["row", "sub", "command"]);
    const sub = sections[0]!.items[1]!;
    expect(sub.type === "sub" && sub.items[0]).toEqual({
      type: "field",
      path: "letterSpacing",
      control: "dial",
      label: "Gap",
    });
  });
  it("puts unplaced fields in Other, last, with an issue", () => {
    const { sections, issues } = resolveLayout(
      element([{ title: "A", items: ["size"] }]),
      controlOf,
    );
    expect(sections.at(-1)!.title).toBe("Other");
    expect(issues.map((i) => i.message)).toContain('element "note": property "text" is not placed');
  });
  it("reports unknown and twice-placed paths and skips them", () => {
    const { sections, issues } = resolveLayout(
      element([{ title: "A", items: ["size", "size", "nope", "text", "letterSpacing", "box"] }]),
      controlOf,
    );
    expect(sections[0]!.items).toHaveLength(4);
    expect(issues.map((i) => i.message)).toEqual([
      'element "note", section "A": path "size" is placed twice',
      'element "note", section "A": path "nope" does not exist',
    ]);
  });
  it("flattens a sub-section inside a sub-section, with an issue", () => {
    const { sections, issues } = resolveLayout(
      element([
        {
          title: "A",
          items: [
            "text",
            "size",
            { title: "Outer", items: [{ title: "Inner", items: ["letterSpacing"] }] },
          ],
        },
        { items: ["box"] },
      ]),
      controlOf,
    );
    const outer = sections[0]!.items[2]!;
    expect(outer.type === "sub" && outer.items[0]!.type).toBe("field");
    expect(issues[0]!.message).toContain("can't nest");
  });
  it("leaves out a shared group's section when the layout placed the group", () => {
    expect(titles([...all, { items: ["transform"] }])).toEqual(["All", "Transform"]);
    expect(titles(all)).toEqual(["All", "Transform"]);
  });
  it("shows a shared group's own layout with its paths under its key", () => {
    const withLayout = { ...transform, layout: { title: "Move", items: [{ row: ["x", "y"] }] } };
    const { sections } = resolveLayout(element(all, [withLayout]), controlOf);
    const row = sections[1]!.items[0]!;
    expect(sections[1]!.title).toBe("Move");
    expect(row.type === "row" && row.items.map((i) => i.type === "field" && i.path)).toEqual([
      "transform.x",
      "transform.y",
    ]);
  });
});

describe("resolveLayout fixes", () => {
  it("places a color's opacity sibling with the color", () => {
    const tint = prop.group(
      { label: "Tint" },
      { color: prop.color({ opacity: "opacity" }), opacity: prop.number() },
    );
    const { sections, issues } = resolveLayout(element(undefined, [], { tint }), controlOf);
    expect(sections[0]!.items.map((i) => (i.type === "field" ? i.path : i.type))).toEqual([
      "tint.color",
    ]);
    expect(issues).toEqual([]);
  });

  it("lets a row repeat a path placed elsewhere", () => {
    const { issues } = resolveLayout(
      element([{ title: "A", items: [{ row: ["size"] }, "size", "text", "letterSpacing", "box"] }]),
      controlOf,
    );
    expect(issues).toEqual([]);
  });
});
