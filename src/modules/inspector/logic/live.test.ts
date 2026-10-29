import { describe, expect, it } from "vitest";
import { createPropsLive, livePatchChanged } from "./live";

describe("livePatchChanged", () => {
  const resolved = { size: 10, outline: { enabled: false, width: 8 } };
  it("is false when every value is already the resolved one", () => {
    expect(livePatchChanged(resolved, { size: 10, outline: { width: 8 } })).toBe(false);
    expect(livePatchChanged(resolved, {})).toBe(false);
  });
  it("is true when one value differs, nested or not", () => {
    expect(livePatchChanged(resolved, { size: 11 })).toBe(true);
    expect(livePatchChanged(resolved, { outline: { enabled: true } })).toBe(true);
  });
});

function harness(resolved: Record<string, unknown> | null = { size: 10, box: { pad: 4 } }) {
  const previews: Array<Record<string, unknown> | null> = [];
  const commits: Array<Record<string, unknown>> = [];
  const live = createPropsLive({
    preview: (patch) => void previews.push(patch),
    read: () => resolved,
    commit: async (patch) => void commits.push(patch),
  });
  return { live, previews, commits };
}

describe("createPropsLive", () => {
  it("previews every input merged with the ones before", () => {
    const { live, previews } = harness();
    live.input({ box: { pad: 5 } });
    live.input({ size: 12 });
    expect(previews.at(-1)).toEqual({ box: { pad: 5 }, size: 12 });
  });
  it("commits everything input so far plus the last patch, then clears", async () => {
    const { live, previews, commits } = harness();
    live.input({ size: 12 });
    live.commit({ box: { pad: 6 } });
    await Promise.resolve();
    await Promise.resolve();
    expect(commits).toEqual([{ size: 12, box: { pad: 6 } }]);
    expect(previews.at(-1)).toBeNull();
  });
  it("skips the command when nothing changes", () => {
    const { live, previews, commits } = harness();
    live.commit({ size: 10 });
    expect(commits).toEqual([]);
    expect(previews.at(-1)).toBeNull();
  });
  it("clears without committing when disposed mid-drag (clip deleted or deselected)", () => {
    const { live, previews, commits } = harness();
    live.input({ size: 30 });
    live.dispose();
    expect(previews.at(-1)).toBeNull();
    expect(commits).toEqual([]);
  });
  it("sends nothing when the clip is gone at release", () => {
    const { live, commits } = harness(null);
    live.input({ size: 30 });
    live.commit({});
    expect(commits).toEqual([]);
  });
});
