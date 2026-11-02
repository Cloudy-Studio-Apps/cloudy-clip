import { describe, expect, it } from "vitest";
import { createEmptyProject, type Clip, type ProjectState } from "@/modules/project";
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

  it("opens a version 1 file with no bins", () => {
    const old = file((json) => {
      json.version = 1;
      for (const key of ["bins", "binOrder", "solids", "solidOrder"]) {
        delete (json.document as Record<string, unknown>)[key];
      }
    });
    expect(decodeProject(old)).toEqual(document);
    expect(decodeProject(old).bins).toEqual({});
    expect(decodeProject(old).binOrder).toEqual([]);
  });

  it("keeps a clip's keys, saves version 3 and still opens version 2", () => {
    const clip: Clip = {
      id: "c",
      trackId: "t",
      kind: "text",
      start: 0,
      sourceIn: 0,
      duration: 1_000_000,
      props: {},
      animation: {
        "transform.x": {
          blend: "number",
          shared: true,
          keys: [{ id: "k0", t: 0, value: 5 }],
        },
      },
      animationOrigin: 250_000,
    };
    const animated: ProjectState = { ...document, clips: { c: clip } };
    const text = encodeProject(animated, "1.0.0", new Date(0));
    expect((JSON.parse(text) as { version: number }).version).toBe(3);
    expect(decodeProject(text)).toEqual(animated);
    const old = file((json) => (json.version = 2));
    expect(decodeProject(old)).toEqual(document);
  });

  it("refuses what it can't trust", () => {
    expect(codeOf("not json")).toBe("workspace.not_a_project");
    expect(codeOf(file((json) => (json.format = "other")))).toBe("workspace.not_a_project");
    expect(codeOf(file((json) => (json.version = 99)))).toBe("workspace.too_new");
    expect(codeOf(file((json) => (json.document = { media: {} })))).toBe("workspace.damaged");
  });
});
