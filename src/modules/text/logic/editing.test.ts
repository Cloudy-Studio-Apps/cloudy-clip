import { describe, expect, it } from "vitest";
import { editCommitAction, EDIT_HIDDEN_STYLE } from "./editing";

describe("editCommitAction", () => {
  it("does nothing when the words are unchanged", () => {
    expect(editCommitAction("a", "a")).toBe("none");
  });
  it("reverts when the words are emptied or only blank", () => {
    expect(editCommitAction("a", "  \n")).toBe("revert");
    expect(editCommitAction("a", "")).toBe("revert");
  });
  it("commits changed words", () => {
    expect(editCommitAction("a", "b")).toBe("commit");
    expect(editCommitAction("a", "a\nb")).toBe("commit");
  });
});

describe("EDIT_HIDDEN_STYLE", () => {
  it("hides the fill, shadow, outline and background without moving the layout", () => {
    expect(EDIT_HIDDEN_STYLE.fill).toEqual({ opacity: 0 });
    expect(EDIT_HIDDEN_STYLE.shadow).toEqual({ enabled: false });
    expect(EDIT_HIDDEN_STYLE.outline).toEqual({ enabled: false });
    expect(EDIT_HIDDEN_STYLE.background).toEqual({ opacity: 0 });
    expect(Object.keys(EDIT_HIDDEN_STYLE)).not.toContain("size");
  });
});
