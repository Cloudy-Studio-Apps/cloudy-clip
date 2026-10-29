import { describe, expect, it } from "vitest";
import type { FontFamily } from "@/modules/fonts";
import { availableWeights, pickVariant, visibleWindow } from "./fontpick";

const roboto: FontFamily = {
  family: "Roboto",
  source: "google",
  variants: [
    { weight: "400", style: "normal" },
    { weight: "700", style: "normal" },
    { weight: "400", style: "italic" },
  ],
};

describe("pickVariant", () => {
  it("keeps the wanted face when the family has it", () => {
    expect(pickVariant(roboto, { weight: "700", style: "normal" })).toEqual({
      weight: "700",
      style: "normal",
    });
  });
  it("takes the closest face when it does not", () => {
    expect(pickVariant(roboto, { weight: "900", style: "normal" })).toEqual({
      weight: "700",
      style: "normal",
    });
    expect(pickVariant(roboto, { weight: "700", style: "italic" })).toEqual({
      weight: "400",
      style: "italic",
    });
  });
  it("keeps the wish for an unknown family", () => {
    expect(pickVariant(undefined, { weight: "800", style: "italic" })).toEqual({
      weight: "800",
      style: "italic",
    });
  });
});

describe("availableWeights", () => {
  it("lists the weights of a family once, ascending", () => {
    expect(availableWeights(roboto)).toEqual(["400", "700"]);
  });
  it("lists all nine for an unknown family", () => {
    expect(availableWeights(undefined)).toHaveLength(9);
  });
});

describe("visibleWindow", () => {
  it("covers the viewport plus overscan", () => {
    expect(visibleWindow(0, 100, 20, 1000, 2)).toEqual({ start: 0, end: 7 });
    expect(visibleWindow(200, 100, 20, 1000, 2)).toEqual({ start: 8, end: 17 });
  });
  it("clamps to the row count", () => {
    expect(visibleWindow(1900, 100, 20, 100, 2)).toEqual({ start: 93, end: 100 });
    expect(visibleWindow(0, 100, 20, 0, 2)).toEqual({ start: 0, end: 0 });
  });
});
