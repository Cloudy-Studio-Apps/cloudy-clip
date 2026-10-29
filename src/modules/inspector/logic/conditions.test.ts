import { describe, expect, it } from "vitest";
import { isEnabled, isVisible } from "./conditions";

const values = { outline: { enabled: false }, size: 10 };

describe("conditions", () => {
  it("reads a path to a boolean", () => {
    expect(isVisible({ kind: "number", visibleWhen: "outline.enabled" }, values)).toBe(false);
    expect(isEnabled({ kind: "number", enabledWhen: "outline.enabled" }, values)).toBe(false);
  });
  it("calls a function condition", () => {
    expect(isVisible({ kind: "number", visibleWhen: (v) => v.size === 10 }, values)).toBe(true);
  });
  it("holds when there is no condition", () => {
    expect(isVisible({ kind: "number" }, values)).toBe(true);
    expect(isEnabled({ kind: "number" }, values)).toBe(true);
  });
  it("is disabled when read-only", () => {
    expect(isEnabled({ kind: "number", readOnly: true }, values)).toBe(false);
  });
});
