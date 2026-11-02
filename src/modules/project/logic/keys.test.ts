import { describe, expect, it } from "vitest";
import type { KeyTrack } from "../project.types";
import { mirrorEase, moveTrackKeys, withoutKeys, writeKey } from "./keys";

const S = 1_000_000;
const base: KeyTrack = {
  blend: "number",
  keys: [
    { id: "a", t: 0, value: 0, ease: { kind: "hold" } },
    { id: "b", t: S, value: 1 },
  ],
};

describe("keys", () => {
  it("updates the key within tolerance and keeps its id", () => {
    const next = writeKey(base, S + 10, 5, 100);
    expect(next.keys.map((k) => [k.id, k.t, k.value])).toEqual([
      ["a", 0, 0],
      ["b", S, 5],
    ]);
  });
  it("inserts in order with the previous key's ease", () => {
    const next = writeKey(base, S / 2, 5, 100);
    expect(next.keys.map((k) => k.t)).toEqual([0, S / 2, S]);
    expect(next.keys[1]!.ease).toEqual({ kind: "hold" });
  });
  it("replaces a key a moved key lands on", () => {
    const next = moveTrackKeys(base, new Map([["a", S]]), 100);
    expect(next.keys.map((k) => k.id)).toEqual(["a"]);
  });
  it("drops an empty track", () => expect(withoutKeys(base, new Set(["a", "b"]))).toBeUndefined());
  it("mirrors a bezier", () =>
    expect(mirrorEase({ kind: "bezier", x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 })).toEqual({
      kind: "bezier",
      x1: 0.7,
      y1: 0.6,
      x2: 0.9,
      y2: 0.8,
    }));
});
