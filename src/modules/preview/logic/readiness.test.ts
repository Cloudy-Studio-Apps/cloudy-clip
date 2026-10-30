import { describe, expect, it } from "vitest";
import type { Clip } from "@/modules/project";
import { picturesSettled } from "./readiness";

const clip = (id: string) => ({ id }) as Clip;

describe("picturesSettled", () => {
  it("is true when every visible picture is ready", () => {
    const items = [{ clip: clip("a"), hidden: false }];
    expect(picturesSettled(items, () => true)).toBe(true);
  });

  it("is false when a visible picture isn't ready", () => {
    const items = [
      { clip: clip("a"), hidden: false },
      { clip: clip("b"), hidden: false },
    ];
    expect(picturesSettled(items, (c) => c.id === "a")).toBe(false);
  });

  it("ignores hidden tracks", () => {
    const items = [{ clip: clip("a"), hidden: true }];
    expect(picturesSettled(items, () => false)).toBe(true);
  });

  it("asks every clip even after one isn't ready, so all of them start loading", () => {
    const items = [
      { clip: clip("a"), hidden: false },
      { clip: clip("b"), hidden: false },
    ];
    let asked = 0;
    picturesSettled(items, () => {
      asked++;
      return false;
    });
    expect(asked).toBe(2);
  });
});
