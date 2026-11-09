import { describe, expect, it } from "vitest";
import { minimizeMaster } from "./mix";

describe("minimizeMaster", () => {
  it("drops a trim of 0 and keeps any other", () => {
    expect(minimizeMaster({ volumeDb: 0, trimDb: 0 })).not.toHaveProperty("trimDb");
    expect(minimizeMaster({ volumeDb: 0, trimDb: -3 }).trimDb).toBe(-3);
  });
});
