import { describe, expect, it } from "vitest";
import { prop } from "@/modules/element";
import { junctionLayoutSource, junctionSetInput } from "./junction";

describe("junctionSetInput", () => {
  it("names the junction and carries the patch", () => {
    expect(junctionSetInput("j1", { patch: { softness: 0.5 } })).toEqual({
      junctionIds: ["j1"],
      patch: { softness: 0.5 },
    });
  });

  it("turns seconds into integer microseconds", () => {
    expect(junctionSetInput("j1", { seconds: 0.5 })).toEqual({
      junctionIds: ["j1"],
      duration: 500_000,
    });
    expect(junctionSetInput("j1", { seconds: 1.0000004 }).duration).toBe(1_000_000);
  });

  it("leaves out what isn't given", () => {
    expect(junctionSetInput("j1", {})).toEqual({ junctionIds: ["j1"] });
  });
});

describe("junctionLayoutSource", () => {
  it("indexes the properties of a kind, without groups", () => {
    const source = junctionLayoutSource("fade", {
      softness: prop.number({ min: 0, max: 1 }),
    });
    expect(source.definition.kind).toBe("fade");
    expect([...source.fields.keys()]).toEqual(["softness"]);
    expect(source.groups).toEqual([]);
  });
});
