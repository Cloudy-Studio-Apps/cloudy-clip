import { describe, expect, it } from "vitest";
import { pushRecent } from "./recents";

describe("pushRecent", () => {
  it("puts the newest color first", () => {
    expect(pushRecent(["#111111"], "#222222")).toEqual(["#222222", "#111111"]);
  });
  it("moves a repeated color to the front instead of duplicating it", () => {
    expect(pushRecent(["#111111", "#222222"], "#222222")).toEqual(["#222222", "#111111"]);
  });
  it("compares colors without case", () => {
    expect(pushRecent(["#aabbcc"], "#AABBCC")).toEqual(["#aabbcc"]);
  });
  it("caps the list at 12 by default and at max when given", () => {
    const full = Array.from({ length: 12 }, (_, i) => `#00000${i.toString(16)}`);
    const next = pushRecent(full, "#ffffff");
    expect(next).toHaveLength(12);
    expect(next[0]).toBe("#ffffff");
    expect(pushRecent(["#111111", "#222222"], "#333333", 2)).toEqual(["#333333", "#111111"]);
  });
  it("does not change the input", () => {
    const list = ["#111111"];
    pushRecent(list, "#222222");
    expect(list).toEqual(["#111111"]);
  });
});
