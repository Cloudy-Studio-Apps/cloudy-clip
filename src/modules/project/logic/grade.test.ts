import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { seedProject } from "../project.testing";
import type { Clip, ClipGrade, Correction, GradeNode } from "../project.types";
import { projectPolicy } from "./fields";
import { canGrade, correctionOf, minimizeGrade } from "./grade";
import { validateGrade } from "./grade.validate";

function correct(input: string, extra: Partial<Correction> = {}): Correction {
  return { kind: "correct", input: { node: input }, on: true, opacity: 1, ...extra };
}

/** `source -> n1 -> n2 ...`, out at the last. */
function chain(length: number): ClipGrade {
  const nodes: Record<string, GradeNode> = {};
  for (let i = 1; i <= length; i++) nodes[`n${i}`] = correct(i === 1 ? "source" : `n${i - 1}`);
  return { nodes, out: { node: `n${length}` } };
}

function clip(extra: Partial<Clip> = {}): Clip {
  return {
    id: "k1",
    trackId: "v1",
    kind: "media",
    start: 0,
    sourceIn: 0,
    duration: 1000,
    props: {},
    ...extra,
  };
}

describe("validateGrade", () => {
  it("accepts a chain from source to out", () => {
    expect(validateGrade(chain(2))).toBeNull();
    expect(validateGrade({ nodes: {}, out: { node: "source" } })).toBeNull();
  });

  it("refuses a missing ref", () => {
    const grade = chain(2);
    grade.nodes["n2"] = correct("ghost");
    expect(validateGrade(grade)).toContain("missing node");
    expect(validateGrade({ nodes: {}, out: { node: "ghost" } })).toContain("missing node");
  });

  it("refuses a cycle", () => {
    const grade = chain(2);
    grade.nodes["n1"] = correct("n2");
    expect(validateGrade(grade)).toContain("cycle");
  });

  it("refuses out not reachable from source", () => {
    const grade: ClipGrade = {
      nodes: { key: { kind: "keyJoin", keys: [] } },
      out: { node: "key" },
    };
    expect(validateGrade(grade)).toContain("source");
  });

  it("refuses a channel ref not from a split", () => {
    const grade = chain(2);
    grade.nodes["n2"] = correct("n1");
    (grade.nodes["n2"] as Correction).input = { node: "n1", channel: "r" };
    expect(validateGrade(grade)).toContain("split");
  });

  it("accepts a channel ref from a split", () => {
    const grade: ClipGrade = {
      nodes: {
        s: { kind: "split", input: { node: "source" } },
        c: correct("s"),
        j: {
          kind: "join",
          r: { node: "c" },
          g: { node: "s", channel: "g" },
          b: { node: "s", channel: "b" },
        },
      },
      out: { node: "j" },
    };
    expect(validateGrade(grade)).toBeNull();
  });

  it("refuses a join with one input, and blends not matching inputs", () => {
    const one: ClipGrade = {
      nodes: { p: { kind: "parallel", inputs: [{ node: "source" }], on: true, opacity: 1 } },
      out: { node: "p" },
    };
    expect(validateGrade(one)).toContain("two inputs");
    const layer: ClipGrade = {
      nodes: {
        l: {
          kind: "layer",
          inputs: [{ node: "source" }, { node: "source" }],
          blends: ["normal"],
          on: true,
          opacity: 1,
        },
      },
      out: { node: "l" },
    };
    expect(validateGrade(layer)).toContain("blends");
  });

  it("refuses limit.from that makes a cycle", () => {
    const grade = chain(2);
    grade.nodes["n1"] = correct("source", { limit: { from: "n2" } });
    expect(validateGrade(grade)).toContain("cycle");
    const ghost = chain(1);
    ghost.nodes["n1"] = correct("source", { limit: { from: "nope" } });
    expect(validateGrade(ghost)).toContain("missing node");
  });

  it("refuses a value out of range", () => {
    const grade = chain(1);
    grade.nodes["n1"] = correct("source", { values: { exposure: 5 } });
    expect(validateGrade(grade)).toContain("exposure");
    grade.nodes["n1"] = correct("source", { values: { lift: { x: 2, y: 0, m: 0 } } });
    expect(validateGrade(grade)).toContain("lift.x");
  });
});

describe("minimizeGrade", () => {
  it("minimizes a correction at defaults to no values", () => {
    const grade = chain(1);
    grade.nodes["n1"] = correct("source", {
      values: { exposure: 0, contrast: 1, saturation: 1.2, lift: { x: 0, y: 0, m: 0 } },
    });
    const min = minimizeGrade(grade)!;
    expect((min.nodes["n1"] as Correction).values).toEqual({ saturation: 1.2 });
    grade.nodes["n1"] = correct("source", { values: { exposure: 0 } });
    expect((minimizeGrade(grade)!.nodes["n1"] as Correction).values).toBeUndefined();
  });

  it("is undefined for source to out with no nodes", () => {
    expect(minimizeGrade({ nodes: {}, out: { node: "source" } })).toBeUndefined();
  });

  it("correctionOf fills a partial value over the defaults", () => {
    const values = correctionOf(correct("source", { values: { lift: { x: 0.5 } as never } }));
    expect(values.lift).toEqual({ x: 0.5, y: 0, m: 0 });
    expect(values.contrast).toBe(1);
  });
});

describe("canGrade", () => {
  const state = seedProject({
    media: {
      m1: { id: "m1", name: "a", path: "/a.mp4", kind: "video", size: 1 },
      m2: { id: "m2", name: "b", path: "/b.mp3", kind: "audio", size: 1 },
    },
  });
  it("is true for pictures on video tracks and compositions", () => {
    expect(canGrade(clip({ mediaId: "m1" }), state)).toBe(true);
    expect(canGrade(clip({ kind: "composition", compositionRef: "c1" }), state)).toBe(true);
    expect(canGrade(clip({ mediaId: "m2" }), state)).toBe(false);
    expect(canGrade(clip({ mediaId: "m1", trackId: "a1" }), state)).toBe(false);
  });
});

describe("the grade in the policy", () => {
  it("projectPolicy.validate refuses a document with a broken grade", () => {
    const base = seedProject({ clips: { k1: clip() } });
    expect(projectPolicy.validate(base)).toBeNull();
    const broken: ClipGrade = { nodes: { n: correct("ghost") }, out: { node: "n" } };
    expect(projectPolicy.validate({ ...base, clips: { k1: clip({ grade: broken }) } })).toMatch(
      /grade/,
    );
    const comp = { ...base.compositions["c1"]!, grade: broken };
    expect(projectPolicy.validate({ ...base, compositions: { c1: comp } })).toMatch(/grade/);
    expect(
      projectPolicy.validate({
        ...base,
        gradeGroups: { g1: { id: "g1", name: "G", grade: broken } },
      }),
    ).toMatch(/grade/);
    expect(
      projectPolicy.validate({
        ...base,
        stills: {
          s1: { id: "s1", name: "S", image: "", grade: broken, from: { time: 0 } },
        },
      }),
    ).toMatch(/still s1/);
  });

  it("settle drops a gradeGroup that no longer exists", () => {
    const grade = chain(1);
    grade.nodes["n1"] = correct("source", { lut: { id: "gone", strength: 1 } });
    const base = seedProject({
      clips: { k1: clip({ gradeGroup: "g1", grade }), k2: clip({ id: "k2", gradeGroup: "g2" }) },
    });
    const state = {
      ...base,
      gradeGroups: { g2: { id: "g2", name: "Keep" } },
      luts: { kept: { id: "kept", name: "K", path: "/k.cube", size: 17 } },
    };
    const next = produce(state, (draft) => projectPolicy.settle!(draft));
    expect(next.clips["k1"]!.gradeGroup).toBeUndefined();
    expect(next.clips["k2"]!.gradeGroup).toBe("g2");
    expect((next.clips["k1"]!.grade!.nodes["n1"] as Correction).lut).toBeUndefined();
  });
});

describe("validateGrade value shapes", () => {
  const withValues = (values: unknown): ClipGrade => ({
    nodes: { n1: correct("source", { values: values as Correction["values"] }) },
    out: { node: "n1" },
  });

  it("refuses unknown or mistyped correction values", () => {
    expect(validateGrade(withValues({ bogus: 1 }))).toContain("values.bogus");
    expect(validateGrade(withValues({ exposure: "x" }))).toContain("values.exposure");
    expect(validateGrade(withValues({ lift: 5 }))).toContain("values.lift");
    expect(validateGrade(withValues({ lift: { x: 0, y: 0, m: 0, z: 1 } }))).toContain(
      "values.lift.z",
    );
    expect(validateGrade(withValues({ protectSkin: 1 }))).toContain("values.protectSkin");
    expect(validateGrade(withValues({ curves: { hueSat: 3 } }))).toContain("values.curves.hueSat");
    expect(validateGrade(withValues({ curves: { hueSat: [["a", 1]] } }))).toContain(
      "values.curves.hueSat[0][0]",
    );
    expect(validateGrade(withValues({ curves: { hueSat: [5] } }))).toContain(
      "values.curves.hueSat[0]",
    );
    expect(validateGrade(withValues({ curves: { hueSat: [[0, 2]] } }))).toContain("out of range");
    expect(validateGrade(withValues({ mixer: { matrix: [["x"]] } }))).toContain(
      "values.mixer.matrix[0][0]",
    );
    expect(validateGrade(withValues({ warper: { pinned: ["a"] } }))).toContain(
      "values.warper.pinned[0]",
    );
    const bad = (values: unknown) => validateGrade(withValues(values));
    expect(bad({ curves: { hueSat: [[0]] } })).toContain("values.curves.hueSat[0]");
    expect(bad({ curves: { hueSat: [[0, 0.5, 0.2]] } })).toContain("values.curves.hueSat[0]");
    expect(bad({ curves: { hueSat: [] } })).toContain("values.curves.hueSat");
    expect(bad({ curves: { hueSat: [[0, 0.5]] } })).toContain("values.curves.hueSat");
    expect(
      bad({
        curves: {
          hueSat: [
            [0, 0.5],
            [0.7, 0.5],
            [0.3, 0.5],
            [1, 0.5],
          ],
        },
      }),
    ).toContain("sorted");
    expect(
      bad({
        mixer: {
          matrix: [
            [1, 0],
            [0, 1, 0],
            [0, 0, 1],
          ],
        },
      }),
    ).toContain("values.mixer.matrix[0]");
    expect(
      bad({
        mixer: {
          matrix: [
            [1, 0, 0],
            [0, 1, 0],
          ],
        },
      }),
    ).toContain("values.mixer.matrix");
    expect(bad({ warper: { pinned: [1.5] } })).toContain("values.warper.pinned[0]");
    expect(bad({ warper: { pinned: [-1] } })).toContain("values.warper.pinned[0]");
    expect(bad({ warper: { pinned: [0, 5, 35] } })).toBeNull();
    expect(
      validateGrade(
        withValues({
          exposure: 1,
          lift: { x: 0.1, y: 0, m: 0 },
          warper: { points: { 3: { dh: 1, ds: 0 } } },
        }),
      ),
    ).toBeNull();
  });
});
