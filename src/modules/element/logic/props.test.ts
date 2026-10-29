import { describe, expect, it } from "vitest";
import { defaultControl, prop } from "./props";

describe("defaultControl", () => {
  it("is segmented for an enum of up to four values, select above", () => {
    expect(defaultControl(prop.enum(["l", "c", "r"]))).toBe("segmented");
    expect(defaultControl(prop.enum(["1", "2", "3", "4", "5"]))).toBe("select");
  });
  it("uses the spec's own control when it names one", () => {
    expect(defaultControl(prop.number({ control: "slider" }))).toBe("slider");
  });
  it("picks a control per value type", () => {
    expect(defaultControl(prop.string())).toBe("text");
    expect(defaultControl(prop.string({ multiline: true }))).toBe("textarea");
    expect(defaultControl(prop.number())).toBe("number");
    expect(defaultControl(prop.boolean())).toBe("toggle");
    expect(defaultControl(prop.color())).toBe("color");
  });
  it("takes a custom prop's control from its type, or unknown", () => {
    const spec = { kind: "custom" as const, type: "font" };
    expect(
      defaultControl(spec, { name: "font", control: "font-picker", schema: () => null! }),
    ).toBe("font-picker");
    expect(defaultControl(spec)).toBe("unknown");
  });
});

describe("prop.group", () => {
  it("keeps its fields and toggle", () => {
    const group = prop.group({ label: "Box", toggle: "on" }, { on: prop.boolean() });
    expect(group).toMatchObject({ kind: "group", label: "Box", toggle: "on" });
    expect(group.fields?.on?.kind).toBe("boolean");
  });
});
