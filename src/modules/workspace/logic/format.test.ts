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

  it("saves version 4 only with grades, and drops a broken grade instead of refusing the file", () => {
    expect(JSON.parse(encodeProject(document, "1.0.0", new Date(0))).version).toBe(2);
    const graded: ProjectState = {
      ...document,
      clips: {
        c: {
          id: "c",
          trackId: "t",
          kind: "video",
          start: 0,
          sourceIn: 0,
          duration: 1,
          props: {},
          grade: { nodes: 3, out: null },
        } as unknown as Clip,
      },
    };
    const text = encodeProject(graded, "1.0.0", new Date(0));
    expect(JSON.parse(text).version).toBe(4);
    expect(decodeProject(text).clips.c!.grade).toBeUndefined();
  });

  it("opens a library solid with no size, and keeps one that has a size", () => {
    const solids = {
      a: { id: "a", name: "Match", color: "#000000" },
      b: { id: "b", name: "Own", color: "#000000", width: 10, height: 20 },
    };
    const text = file((json) => Object.assign(json.document as object, { solids }));
    expect(decodeProject(text).solids).toEqual(solids);
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

  it("saves version 2 without keys, 3 with them, and opens both", () => {
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
    const plain = encodeProject(document, "1.0.0", new Date(0));
    expect((JSON.parse(plain) as { version: number }).version).toBe(2);
    expect(decodeProject(plain)).toEqual(document);
  });

  it("refuses what it can't trust", () => {
    expect(codeOf("not json")).toBe("workspace.not_a_project");
    expect(codeOf(file((json) => (json.format = "other")))).toBe("workspace.not_a_project");
    expect(codeOf(file((json) => (json.version = 99)))).toBe("workspace.too_new");
    expect(codeOf(file((json) => (json.document = { media: {} })))).toBe("workspace.damaged");
  });

  const followed: ProjectState = {
    ...document,
    tracks: {
      t: {
        id: "t",
        compositionId: "c",
        kind: "video",
        name: "V",
        clipIds: ["c"],
        muted: false,
        hidden: false,
      },
    },
    clips: {
      c: {
        id: "c",
        trackId: "t",
        kind: "text",
        start: 0,
        sourceIn: 0,
        duration: 1,
        props: {},
        follow: { pathId: "p", progress: 0, orient: false },
      },
    },
    paths: {
      p: {
        id: "p",
        compositionId: "c",
        name: "Path 1",
        closed: false,
        points: [
          { x: 0, y: 0, inX: 0, inY: 0, outX: 0, outY: 0 },
          { x: 1, y: 1, inX: 0, inY: 0, outX: 0, outY: 0 },
        ],
      },
    },
  };

  it("a project with paths round-trips at version 5", () => {
    const text = encodeProject(followed, "1.0.0", new Date(0));
    expect(JSON.parse(text).version).toBe(5);
    expect(decodeProject(text)).toEqual(followed);
  });

  it("a dangling follow is dropped on open", () => {
    const text = encodeProject({ ...followed, paths: {} }, "1.0.0", new Date(0));
    expect(decodeProject(text).clips.c!.follow).toBeUndefined();
  });
  const masked = (change: (clip: Clip) => void): ProjectState => {
    const clip: Clip = { ...followed.clips.c! };
    delete clip.follow;
    change(clip);
    return { ...followed, paths: {}, clips: { c: clip } };
  };
  const mask = {
    id: "m",
    name: "Mask 1",
    color: "pink",
    mode: "add",
    opacity: 1,
    feather: 4,
    expansion: 0,
    x: 0,
    y: 0,
    rotation: 0,
    shape: { kind: "rectangle", width: 100, height: 50, roundness: 0.2 },
  } as const;

  it("writes version 6 only when a clip has masks or a matte", () => {
    const plain = masked(() => {});
    expect(JSON.parse(encodeProject(plain, "1.0.0", new Date(0))).version).toBeLessThanOrEqual(5);
    const withMask = masked((clip) => {
      clip.masks = { m: mask };
      clip.maskOrder = ["m"];
    });
    expect(JSON.parse(encodeProject(withMask, "1.0.0", new Date(0))).version).toBe(6);
  });

  it("reads masks back unchanged", () => {
    const withMask = masked((clip) => {
      clip.masks = { m: mask };
      clip.maskOrder = ["m"];
      clip.matte = { trackId: "t", by: "luma", invert: true };
    });
    expect(decodeProject(encodeProject(withMask, "1.0.0", new Date(0)))).toEqual(withMask);
  });

  it("a star with a fractional point count saves and reopens", () => {
    const star = masked((clip) => {
      clip.masks = {
        m: { ...mask, shape: { kind: "star", width: 100, height: 100, points: 5.5, inner: 0.5 } },
      };
      clip.maskOrder = ["m"];
    });
    expect(decodeProject(encodeProject(star, "1.0.0", new Date(0)))).toEqual(star);
  });

  it("drops a matte whose track is missing", () => {
    const text = encodeProject(
      masked((clip) => (clip.matte = { trackId: "gone", by: "alpha" })),
      "1.0.0",
      new Date(0),
    );
    expect(decodeProject(text).clips.c!.matte).toBeUndefined();
  });
});
