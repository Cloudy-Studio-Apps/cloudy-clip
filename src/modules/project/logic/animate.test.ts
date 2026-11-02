import { describe, expect, it } from "vitest";
import { IDENTITY_TRANSFORM, clipTransform } from "../project.geometry";
import type { Clip, KeyTrack, Keyframe } from "../project.types";
import { animatedClip, trackValue } from "./animate";

const S = 1_000_000;

const track = (keys: Partial<Keyframe>[], rest: Partial<KeyTrack> = {}): KeyTrack => ({
  blend: "number",
  keys: keys.map((k, i) => ({ id: `k${i}`, t: 0, value: 0, ...k })),
  ...rest,
});

describe("trackValue", () => {
  it("blends numbers, and holds outside the keys", () => {
    const t = track([
      { t: S, value: 0 },
      { t: 3 * S, value: 100 },
    ]);
    expect(trackValue(t, 2 * S)).toBeCloseTo(50);
    expect(trackValue(t, 0)).toBe(0);
    expect(trackValue(t, 9 * S)).toBe(100);
  });

  it("blends colors per channel", () => {
    const t = track(
      [
        { t: 0, value: "#000000" },
        { t: S, value: "#ffffff" },
      ],
      { blend: "color" },
    );
    expect(trackValue(t, S / 2)).toBe("#808080");
  });

  it("steps enums to the left key", () => {
    const t = track(
      [
        { t: 0, value: "normal" },
        { t: S, value: "screen" },
      ],
      { blend: "step" },
    );
    expect(trackValue(t, S - 1)).toBe("normal");
    expect(trackValue(t, S)).toBe("screen");
  });

  it("clamps an overshoot to the range", () => {
    const ease = { kind: "bezier", x1: 0.34, y1: 3, x2: 0.64, y2: 1 } as const;
    const t = track(
      [
        { t: 0, value: 0, ease },
        { t: S, value: 1 },
      ],
      { min: 0, max: 1 },
    );
    expect(trackValue(t, S / 2)).toBe(1);
  });

  it("loops and ping-pongs after the last key", () => {
    const keys = [
      { t: 0, value: 0 },
      { t: S, value: 100 },
    ];
    expect(trackValue(track(keys, { after: "loop" }), 1.5 * S)).toBeCloseTo(50);
    expect(trackValue(track(keys, { after: "pingpong" }), 1.25 * S)).toBeCloseTo(75);
  });
});

describe("animatedClip", () => {
  it("gives back the same object for a clip with no animation", () => {
    const clip: Clip = {
      id: "c",
      start: 0,
      duration: S,
      sourceIn: 0,
      trackId: "t",
      kind: "x",
      props: {},
    };
    expect(animatedClip(clip, 0)).toBe(clip);
  });

  it("writes shared and nested values, and leaves the saved clip alone", () => {
    const clip: Clip = {
      id: "c",
      start: 0,
      duration: S,
      sourceIn: 0,
      trackId: "t",
      kind: "x",
      props: { outline: { width: 1 } },
      animation: {
        "transform.x": track([{ t: 0, value: 50 }], { shared: true }),
        "outline.width": track([{ t: 0, value: 9 }]),
      },
    };
    const now = animatedClip(clip, 0);
    expect(clipTransform(now)).toEqual({ ...IDENTITY_TRANSFORM, x: 50 });
    expect(now.props.outline).toEqual({ width: 9 });
    expect(clip.transform).toBeUndefined();
    expect(clip.props.outline).toEqual({ width: 1 });
  });
});
