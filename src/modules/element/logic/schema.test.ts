import { describe, expect, it } from "vitest";
import { prop } from "./props";
import { patchSchema } from "./schema";

const tree = {
  text: prop.string({ min: 1, trim: true }),
  size: prop.number({ min: 1, max: 2000 }),
  outline: prop.group(
    { label: "Outline", toggle: "enabled" },
    { enabled: prop.boolean(), color: prop.color(), width: prop.number({ min: 0, max: 200 }) },
  ),
};
const env = { propType: () => undefined, groups: [] };

describe("patchSchema", () => {
  it("refuses blank text, out-of-range numbers and unknown keys", () => {
    const schema = patchSchema(tree, env);
    expect(schema.safeParse({ text: "   " }).success).toBe(false);
    expect(schema.safeParse({ size: 5000 }).success).toBe(false);
    expect(schema.safeParse({ volume: 1 }).success).toBe(false);
    expect(schema.safeParse({ outline: { thickness: 1 } }).success).toBe(false);
  });
  it("accepts partial groups and lowercases colors", () => {
    const schema = patchSchema(tree, env);
    expect(schema.parse({ outline: { width: 10 } })).toEqual({ outline: { width: 10 } });
    expect(schema.parse({ outline: { color: "#FFAA00" } })).toEqual({
      outline: { color: "#ffaa00" },
    });
    expect(schema.safeParse({ outline: { color: "red" } }).success).toBe(false);
  });
  it("trims strings that ask for it", () => {
    expect(patchSchema(tree, env).parse({ text: "  Hi " })).toEqual({ text: "Hi" });
  });
  it("parses shared groups under their key", () => {
    const schema = patchSchema(tree, {
      propType: () => undefined,
      groups: [{ key: "transform", tree: { x: prop.number() } }],
    });
    expect(schema.safeParse({ transform: { x: 4 } }).success).toBe(true);
    expect(schema.safeParse({ transform: { rotation: 4 } }).success).toBe(false);
  });
  it("skips dotted override keys of shared fields", () => {
    const schema = patchSchema({ ...tree, "transform.scale": { kind: "number", max: 10 } }, env);
    expect(schema.safeParse({ "transform.scale": 2 }).success).toBe(false);
  });
});

describe("patchSchema with a missing value type", () => {
  it("refuses any value of an unregistered custom type", () => {
    const ghost = { font: { kind: "custom", type: "ghost" } } as const;
    const schema = patchSchema(ghost, { propType: () => undefined, groups: [] });
    expect(schema.safeParse({ font: {} }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(true);
  });
});
