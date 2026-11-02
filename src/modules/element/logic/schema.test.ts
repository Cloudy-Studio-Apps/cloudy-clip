import { describe, expect, it } from "vitest";
import { prop } from "./props";
import { patchSchema } from "./schema";

const schema = patchSchema({ g: prop.gradient() }, { propType: () => undefined, groups: [] });
const stop = (at: number, color = "#000000") => ({ at, color, opacity: 1 });
const gradient = (stops: unknown[]) => ({ g: { type: "linear", angle: 0, stops } });

describe("gradient values", () => {
  it("keeps a valid gradient and lowers its colors", () => {
    const parsed = schema.parse(gradient([stop(0, "#AABBCC"), stop(1)])) as {
      g: { stops: { color: string }[] };
    };
    expect(parsed.g.stops[0]!.color).toBe("#aabbcc");
  });

  it("refuses too few stops, too many, a stop outside the bar and unknown keys", () => {
    expect(schema.safeParse(gradient([stop(0)])).success).toBe(false);
    expect(schema.safeParse(gradient(Array.from({ length: 9 }, () => stop(0)))).success).toBe(
      false,
    );
    expect(schema.safeParse(gradient([stop(0), stop(2)])).success).toBe(false);
    expect(schema.safeParse({ g: { ...gradient([stop(0), stop(1)]).g, x: 1 } }).success).toBe(
      false,
    );
  });
});
