import { describe, expect, it } from "vitest";
import { rememberPlayheads } from "./playheads";

describe("rememberPlayheads", () => {
  it("gives each composition its own time", () => {
    const playheads = rememberPlayheads();
    expect(playheads.switchTo("c1", "c2", 2_000_000)).toBe(0);
    expect(playheads.switchTo("c2", "c1", 500_000)).toBe(2_000_000);
    expect(playheads.switchTo("c1", "c2", 2_000_000)).toBe(500_000);
  });

  it("starts at 0 coming from nothing", () => {
    expect(rememberPlayheads().switchTo(null, "c1", 7)).toBe(0);
  });
});
