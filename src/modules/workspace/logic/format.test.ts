import { describe, expect, it } from "vitest";
import { createEmptyProject, type ProjectState } from "@/modules/project";
import { decodeProject, encodeProject } from "./format";

const document: ProjectState = {
  ...createEmptyProject(),
  description: "Launch teaser",
  media: { a: { id: "a", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 } },
  mediaOrder: ["a"],
};

function file(change: (json: Record<string, unknown>) => void): string {
  const json = JSON.parse(encodeProject(document, "1.0.0", new Date(0))) as Record<string, unknown>;
  change(json);
  return JSON.stringify(json);
}

function codeOf(text: string): string | undefined {
  try {
    decodeProject(text);
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

describe("project file", () => {
  it("gives back what was saved", () => {
    expect(decodeProject(encodeProject(document, "1.0.0", new Date(0)))).toEqual(document);
  });

  it("refuses what it can't trust", () => {
    expect(codeOf("not json")).toBe("workspace.not_a_project");
    expect(codeOf(file((json) => (json.format = "other")))).toBe("workspace.not_a_project");
    expect(codeOf(file((json) => (json.version = 99)))).toBe("workspace.too_new");
    expect(codeOf(file((json) => (json.document = { media: {} })))).toBe("workspace.damaged");
  });
});
