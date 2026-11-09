import { describe, expect, it } from "vitest";
import type { ClipGrade, Correction, GradeNode } from "@/modules/project";
import { validateGrade } from "@/modules/project";
import { sealedRegions } from "./seal";
import { emptyGrade, numberOf, toStack } from "./stack";
import { insertLayer, moveLayer, removeNodes } from "./stack.edit";
import { groupLayers, ungroup } from "./stack.group";

function correct(input: string, extra: Partial<Correction> = {}): Correction {
  return { kind: "correct", input: { node: input }, on: true, opacity: 1, ...extra };
}

/** `source -> ids[0] -> ids[1] ...`, out at the last. */
function chain(...ids: string[]): ClipGrade {
  const nodes: Record<string, GradeNode> = {};
  ids.forEach((id, i) => (nodes[id] = correct(i === 0 ? "source" : ids[i - 1]!)));
  return { nodes, out: { node: ids[ids.length - 1] ?? "source" } };
}

/** a, then b and c side by side from a (joined by j), then z. */
function sideBySide(): ClipGrade {
  return {
    nodes: {
      a: correct("source"),
      b: correct("a"),
      c: correct("a"),
      c2: correct("c"),
      j: { kind: "parallel", inputs: [{ node: "b" }, { node: "c2" }], on: true, opacity: 1 },
      z: correct("j"),
    },
    out: { node: "z" },
  };
}

/** a, then c feeds both j1 and j2: it rejoins at a different point. */
function crossing(): ClipGrade {
  return {
    nodes: {
      a: correct("source"),
      b: correct("a"),
      c: correct("a"),
      j1: { kind: "parallel", inputs: [{ node: "b" }, { node: "c" }], on: true, opacity: 1 },
      d: correct("j1"),
      j2: { kind: "parallel", inputs: [{ node: "d" }, { node: "c" }], on: true, opacity: 1 },
      z: correct("j2"),
    },
    out: { node: "z" },
  };
}

describe("toStack", () => {
  it("a chain is layers top to bottom", () => {
    expect(toStack(chain("a", "b", "c"))).toEqual([
      { type: "layer", id: "a" },
      { type: "layer", id: "b" },
      { type: "layer", id: "c" },
    ]);
    expect(toStack(null)).toEqual([]);
    expect(toStack(emptyGrade())).toEqual([]);
  });

  it("numbers layers 01.. in stack order, depth first", () => {
    expect(numberOf(sideBySide())).toEqual({ a: "01", b: "02", c: "03", c2: "04", z: "05" });
    expect(numberOf(null)).toEqual({});
  });

  it("a parallel join of two chains is a side-by-side group", () => {
    expect(toStack(sideBySide())).toEqual([
      { type: "layer", id: "a" },
      {
        type: "group",
        id: "j",
        kind: "parallel",
        branches: [
          [{ type: "layer", id: "b" }],
          [
            { type: "layer", id: "c" },
            { type: "layer", id: "c2" },
          ],
        ],
      },
      { type: "layer", id: "z" },
    ]);
  });

  it("a layer join keeps one blend per branch", () => {
    const grade: ClipGrade = {
      nodes: {
        a: correct("source"),
        b: correct("source"),
        j: {
          kind: "layer",
          inputs: [{ node: "a" }, { node: "b" }, { node: "source" }],
          blends: ["normal", "screen", "multiply"],
          on: true,
          opacity: 1,
        },
      },
      out: { node: "j" },
    };
    expect(toStack(grade)).toEqual([
      {
        type: "group",
        id: "j",
        kind: "layer",
        branches: [[{ type: "layer", id: "a" }], [{ type: "layer", id: "b" }], []],
      },
    ]);
    const added = insertLayer(grade, { after: "a" }, "n", correct("source"));
    const join = added.nodes.j;
    expect(join?.kind === "layer" && join.blends).toEqual(["normal", "screen", "multiply"]);
    expect(join?.kind === "layer" && join.inputs[0]).toEqual({ node: "n" });
  });

  it("split → three chains → join is a per-channel group", () => {
    const grade: ClipGrade = {
      nodes: {
        s: { kind: "split", input: { node: "source" } },
        r: { kind: "correct", input: { node: "s", channel: "r" }, on: true, opacity: 1 },
        g: { kind: "correct", input: { node: "s", channel: "g" }, on: true, opacity: 1 },
        j: { kind: "join", r: { node: "r" }, g: { node: "g" }, b: { node: "s", channel: "b" } },
      },
      out: { node: "j" },
    };
    expect(toStack(grade)).toEqual([
      {
        type: "group",
        id: "j",
        kind: "channels",
        branches: [[{ type: "layer", id: "r" }], [{ type: "layer", id: "g" }], []],
      },
    ]);
  });

  it("groups nest", () => {
    const grade: ClipGrade = {
      nodes: {
        a: correct("source"),
        b: correct("a"),
        c: correct("a"),
        inner: { kind: "parallel", inputs: [{ node: "b" }, { node: "c" }], on: true, opacity: 1 },
        d: correct("source"),
        outer: {
          kind: "parallel",
          inputs: [{ node: "inner" }, { node: "d" }],
          on: true,
          opacity: 1,
        },
      },
      out: { node: "outer" },
    };
    expect(toStack(grade)).toEqual([
      {
        type: "group",
        id: "outer",
        kind: "parallel",
        branches: [
          [
            { type: "layer", id: "a" },
            {
              type: "group",
              id: "inner",
              kind: "parallel",
              branches: [[{ type: "layer", id: "b" }], [{ type: "layer", id: "c" }]],
            },
          ],
          [{ type: "layer", id: "d" }],
        ],
      },
    ]);
  });

  it("a branch that rejoins elsewhere is one sealed card holding exactly its nodes", () => {
    expect(toStack(crossing())).toEqual([
      { type: "layer", id: "a" },
      { type: "sealed", id: "sealed:b", nodes: ["b", "c", "j1", "d", "j2"] },
      { type: "layer", id: "z" },
    ]);
    expect(sealedRegions(crossing())).toEqual([
      { entry: { node: "a" }, exit: "j2", nodes: ["b", "c", "j1", "d", "j2"] },
    ]);
  });

  it("a key join seals its region", () => {
    const grade = chain("a", "b", "c", "d");
    grade.nodes.k = { kind: "keyJoin", keys: [{ from: "b", mode: "add" }] };
    grade.nodes.c = correct("b", { limit: { from: "k" } });
    expect(toStack(grade)).toEqual([
      { type: "layer", id: "a" },
      { type: "sealed", id: "sealed:b", nodes: ["b", "k", "c"] },
      { type: "layer", id: "d" },
    ]);
    // A shared key from a layer above is shown as a layer, not sealed.
    const shared = chain("a", "b", "c");
    shared.nodes.c = correct("b", { limit: { from: "a" } });
    expect(toStack(shared).every((item) => item.type === "layer")).toBe(true);
  });
});

describe("stack edits", () => {
  it("insert then remove gives back the same grade", () => {
    const grade = sideBySide();
    const positions = [
      {},
      { before: "a" },
      { after: "a" },
      { before: "j" },
      { after: "j" },
      { after: "c" },
      { branch: { group: "j", index: 0 } },
    ];
    for (const at of positions) {
      const added = insertLayer(grade, at, "n", correct("source"));
      expect(validateGrade(added)).toBeNull();
      expect(JSON.stringify(toStack(added))).toContain('"n"');
      expect(removeNodes(added, ["n"])).toEqual(grade);
    }
    expect(grade).toEqual(sideBySide());
  });

  it("moveLayer refuses to cross a sealed card", () => {
    const grade = crossing();
    expect(moveLayer(grade, "b", { after: "z" })).toBeNull();
    expect(moveLayer(grade, "a", { before: "d" })).toBeNull();
    const past = moveLayer(grade, "a", { after: "z" });
    expect(past && toStack(past)).toEqual([
      { type: "sealed", id: "sealed:b", nodes: ["b", "c", "j1", "d", "j2"] },
      { type: "layer", id: "z" },
      { type: "layer", id: "a" },
    ]);
    const moved = moveLayer(chain("a", "b", "c"), "c", { before: "a" });
    expect(moved && toStack(moved).map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("groupLayers then ungroup gives back the same grade", () => {
    const grade = chain("a", "b", "c", "d");
    for (const kind of ["parallel", "layer", "channels"] as const) {
      const grouped = groupLayers(grade, ["b", "c"], kind, "g", "s");
      expect(grouped).not.toBeNull();
      const stack = toStack(grouped!);
      expect(stack[1]).toMatchObject({ type: "group", id: "g", kind });
      expect(ungroup(grouped!, "g")).toEqual(grade);
    }
    expect(groupLayers(grade, ["a", "c"], "parallel", "g")).toBeNull();
  });

  it("every result passes validateGrade", () => {
    const grades = [sideBySide(), crossing(), chain("a", "b", "c")];
    const results: (ClipGrade | null)[] = [];
    for (const grade of grades) {
      results.push(insertLayer(grade, { after: "a" }, "n", correct("source")));
      results.push(removeNodes(grade, ["a"]));
      results.push(moveLayer(grade, "a", { after: "z" }));
      results.push(moveLayer(grade, "a", { after: "c" }));
      results.push(groupLayers(grade, ["a"], "channels", "g", "s"));
    }
    const side = sideBySide();
    results.push(moveLayer(side, "z", { branch: { group: "j", index: 1 } }));
    results.push(moveLayer(side, "j", { before: "a" }));
    results.push(removeNodes(side, ["b", "j"]));
    results.push(ungroup(side, "j"));
    for (const result of results) if (result) expect(validateGrade(result)).toBeNull();
    expect(results.filter(Boolean).length).toBeGreaterThan(10);
  });
});
