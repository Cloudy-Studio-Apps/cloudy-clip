import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { elementModule } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import {
  createProjectModule,
  projectRef,
  seedProject,
  type ClipGrade,
  type Correction,
} from "@/modules/project";
import { addClip, timelineModule } from "@/modules/timeline";
import { resetGrade } from "./tint.commands";
import { setShotGroup, setVersion } from "./tint.shot.commands";
import { group, ungroup } from "./tint.group.commands";
import { addCorrection, moveLayer, removeNodes, setCorrection } from "./tint.node.commands";
import { tintModule } from "./tint.module";
import { pastePart } from "./logic/paste";
import { emptyGrade, toStack } from "./logic/stack";
import { insertLayer } from "./logic/stack.edit";
import { wire } from "./tint.wire.commands";
import type { GradeTarget } from "./tint.types";

const S = 1_000_000;
let kernel: Kernel;
let clipId: string;
let target: GradeTarget;
const doc = () => kernel.modules.require(projectRef).store.getState();
const clip = () => doc().clips[clipId]!;
const run = <I>(command: Parameters<Kernel["bus"]["run"]>[0], input: I) =>
  kernel.bus.run(command, input as never);

async function ok<T = unknown>(command: Parameters<Kernel["bus"]["run"]>[0], input: unknown) {
  const result = await run(command, input);
  if (!result.ok) throw new Error(result.error.code);
  return result.value as T;
}

beforeEach(async () => {
  kernel = await createKernel();
  const project = seedProject();
  project.media.mv = { id: "mv", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 };
  project.mediaOrder = ["mv"];
  await kernel.modules.loadAll([
    createProjectModule(project),
    elementModule,
    junctionModule,
    createFakeMediaModule({ mv: { status: "ready", duration: 10 * S, width: 1920, height: 1080 } }),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
    tintModule,
  ]);
  const added = await ok<{ clips: { id: string }[] }>(addClip, { mediaId: "mv", start: 0 });
  clipId = added.clips[0]!.id;
  target = { clipId };
});

describe("grade commands", () => {
  it("adds a correction to an ungraded clip, one undo step, undo leaves no grade field", async () => {
    const { nodeId } = await ok<{ nodeId: string }>(addCorrection, { target });
    expect(clip().grade?.nodes[nodeId]).toMatchObject({
      kind: "correct",
      input: { node: "source" },
    });
    expect(clip().grade?.out).toEqual({ node: nodeId });
    kernel.history.undo();
    expect("grade" in clip()).toBe(false);
  });

  it("sets values and stores only what differs from the defaults", async () => {
    const { nodeId } = await ok<{ nodeId: string }>(addCorrection, { target });
    await ok(setCorrection, { target, nodeId, patch: { values: { exposure: 1, contrast: 1 } } });
    expect(clip().grade?.nodes[nodeId]).toMatchObject({ values: { exposure: 1 } });
    expect((clip().grade?.nodes[nodeId] as { values: object }).values).toEqual({ exposure: 1 });
    await ok(setCorrection, { target, nodeId, patch: { values: { exposure: 0 } } });
    expect(clip().grade?.nodes[nodeId]).not.toHaveProperty("values");
  });

  it("refuses a value out of range with tint.invalid_grade and writes nothing", async () => {
    const typo = await run(setCorrection, {
      target,
      nodeId: (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId,
      patch: { values: { exposure: "x" } },
    });
    expect(typo).toMatchObject({ ok: false, error: { code: "tint.invalid_grade" } });
    const { nodeId } = await ok<{ nodeId: string }>(addCorrection, { target });
    const before = clip().grade;
    const result = await run(setCorrection, { target, nodeId, patch: { values: { exposure: 9 } } });
    expect(result).toMatchObject({ ok: false, error: { code: "tint.invalid_grade" } });
    expect(clip().grade).toEqual(before);
    const added = await run(addCorrection, { target, values: { saturation: 5 } });
    expect(added).toMatchObject({ ok: false, error: { code: "tint.invalid_grade" } });
  });

  it("refuses a text clip with tint.not_gradeable", async () => {
    const store = kernel.modules.require(projectRef).store;
    const trackId = clip().trackId;
    store.api.setState((s) => ({
      clips: {
        ...s.clips,
        t: {
          id: "t",
          kind: "text",
          props: { text: "x" },
          trackId,
          start: 20 * S,
          sourceIn: 0,
          duration: S,
        },
      },
    }));
    const result = await run(addCorrection, { target: { clipId: "t" } });
    expect(result).toMatchObject({ ok: false, error: { code: "tint.not_gradeable" } });
    const missing = await run(addCorrection, { target: { clipId: "nope" } });
    expect(missing).toMatchObject({ ok: false, error: { code: "tint.target_not_found" } });
  });

  it("removes a node, rewires around it and drops its key tracks", async () => {
    const a = (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId;
    const b = (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId;
    store().api.setState((s) => ({
      clips: {
        ...s.clips,
        [clipId]: {
          ...s.clips[clipId]!,
          animation: {
            [`grade.nodes.${a}.values.exposure`]: { keys: [] },
            [`grade.nodes.${b}.values.exposure`]: { keys: [] },
          } as never,
        },
      },
    }));
    await ok(removeNodes, { target, nodeIds: [a] });
    expect(clip().grade?.nodes[a]).toBeUndefined();
    expect(clip().grade?.nodes[b]).toMatchObject({ input: { node: "source" } });
    expect(Object.keys(clip().animation ?? {})).toEqual([`grade.nodes.${b}.values.exposure`]);
    const keyed = await run(setCorrection, {
      target,
      nodeId: b,
      patch: { values: { exposure: 1 } },
    });
    expect(keyed).toMatchObject({ ok: false, error: { code: "tint.animated" } });
    await ok(removeNodes, { target, nodeIds: [b] });
    expect("grade" in clip()).toBe(false);
    expect(clip().animation).toBeUndefined();
  });

  it("moves a layer, and refuses a missing place", async () => {
    const a = (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId;
    const b = (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId;
    await ok(moveLayer, { target, nodeId: b, to: { before: a } });
    expect(clip().grade?.nodes[a]).toMatchObject({ input: { node: b } });
    const result = await run(moveLayer, { target, nodeId: b, to: { before: "nope" } });
    expect(result).toMatchObject({ ok: false, error: { code: "tint.node_not_found" } });
  });

  it("an agent's removal then the user's undo of an older rewire is refused", async () => {
    kernel.history.scopeUndo();
    const a = (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId;
    await ok(addCorrection, { target });
    await kernel.bus.run(
      removeNodes,
      { target, nodeIds: [a] },
      { origin: "agent", actor: "agent-1" },
    );
    const result = await kernel.bus.execute("history.undo", {});
    expect(result.ok).toBe(false);
    expect(clip().grade?.nodes[a]).toBeUndefined();
  });

  it("reset with tools clears only those fields", async () => {
    const { nodeId } = await ok<{ nodeId: string }>(addCorrection, {
      target,
      values: { exposure: 1, lift: { x: 0.1, y: 0, m: 0 } },
      limit: { invert: true },
    });
    await ok(resetGrade, { target, tools: ["wheels"] });
    expect((clip().grade?.nodes[nodeId] as { values: object }).values).toEqual({ exposure: 1 });
    await ok(resetGrade, { target, tools: ["basics", "limit"] });
    expect(clip().grade?.nodes[nodeId]).toEqual({
      kind: "correct",
      input: { node: "source" },
      on: true,
      opacity: 1,
    });
    await ok(resetGrade, { target });
    expect("grade" in clip()).toBe(false);
  });

  it("reset with a nodeId leaves other corrections alone, and a no-op writes nothing", async () => {
    const a = await ok<{ nodeId: string }>(addCorrection, { target, values: { exposure: 1 } });
    const b = await ok<{ nodeId: string }>(addCorrection, { target, values: { exposure: 2 } });
    await ok(resetGrade, { target, tools: ["basics"], nodeId: a.nodeId });
    const nodes = clip().grade!.nodes as Record<string, { values?: object }>;
    expect(nodes[a.nodeId]!.values).toBeUndefined();
    expect(nodes[b.nodeId]!.values).toEqual({ exposure: 2 });
    for (const name of ["exposur", "__proto__", "constructor"]) {
      const bad = await run(resetGrade, { target, fields: [name], nodeId: b.nodeId });
      expect(bad).toMatchObject({ ok: false, error: { code: "tint.invalid_grade" } });
    }
    await ok(resetGrade, { target, fields: ["exposure"], nodeId: b.nodeId });
    expect((clip().grade!.nodes as typeof nodes)[b.nodeId]!.values).toBeUndefined();
    const before = clip().grade;
    await ok(setCorrection, { target, nodeId: b.nodeId, patch: { values: {} } });
    await ok(resetGrade, { target, tools: ["wheels"], nodeId: b.nodeId });
    expect(clip().grade).toBe(before);
  });

  it("groups two layers side by side and ungroup restores them", async () => {
    const a = (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId;
    const b = (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId;
    const before = clip().grade;
    const { joinId } = await ok<{ joinId: string }>(group, {
      target,
      nodeIds: [a, b],
      kind: "parallel",
    });
    expect(clip().grade?.nodes[joinId]).toMatchObject({
      kind: "parallel",
      inputs: [{ node: a }, { node: b }],
    });
    expect(clip().grade?.nodes[b]).toMatchObject({ input: { node: "source" } });
    expect(clip().grade?.out).toEqual({ node: joinId });
    kernel.history.undo();
    expect(clip().grade).toEqual(before);
    kernel.history.redo();
    await ok(ungroup, { target, joinId });
    expect(clip().grade).toEqual(before);
    const lone = await run(group, { target, nodeIds: [a], kind: "parallel" });
    expect(lone).toMatchObject({ ok: false, error: { code: "tint.cant_group" } });
  });

  it("refuses a shared key that makes a cycle", async () => {
    const color = { on: true, hue: [0, 40], sat: [0, 1], lum: [0, 1], soft: 0 };
    const a = (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId;
    const b = (await ok<{ nodeId: string }>(addCorrection, { target, limit: { color } })).nodeId;
    const before = clip().grade;
    const cycle = await run(setCorrection, { target, nodeId: a, patch: { limit: { from: b } } });
    expect(cycle).toMatchObject({ ok: false, error: { code: "tint.key_cycle" } });
    const self = await run(setCorrection, { target, nodeId: b, patch: { limit: { from: b } } });
    expect(self).toMatchObject({ ok: false, error: { code: "tint.key_cycle" } });
    const plain = await run(setCorrection, { target, nodeId: b, patch: { limit: { from: a } } });
    expect(plain).toMatchObject({ ok: false, error: { code: "tint.key_not_limited" } });
    expect(clip().grade).toEqual(before);
    await ok(setCorrection, { target, nodeId: a, patch: { limit: { color } } });
    await ok(setCorrection, { target, nodeId: b, patch: { limit: { from: a } } });
    expect(clip().grade?.nodes[b]).toMatchObject({ limit: { from: a } });
    const shared = await run(group, { target, nodeIds: [a, b], kind: "parallel" });
    expect(shared).toMatchObject({ ok: false, error: { code: "tint.cant_group" } });
    await ok(setCorrection, { target, nodeId: b, patch: { limit: { color } } });
    await ok(group, { target, nodeIds: [a, b], kind: "parallel" });
    const sibling = await run(setCorrection, { target, nodeId: a, patch: { limit: { from: b } } });
    expect(sibling).toMatchObject({ ok: false, error: { code: "tint.key_not_above" } });
  });

  it("wire refuses a cycle", async () => {
    const a = (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId;
    const b = (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId;
    const before = clip().grade;
    const loop = await run(wire, { target, set: [{ nodeId: a, input: { node: b } }] });
    expect(loop).toMatchObject({ ok: false, error: { code: "tint.wire_cycle" } });
    const keyLoop = await run(wire, {
      target,
      add: [{ id: "k", node: { kind: "keyJoin", keys: [{ from: b, mode: "add" }] } }],
      set: [{ nodeId: "k", keys: [{ from: "k", mode: "add" }] }],
    });
    expect(keyLoop).toMatchObject({ ok: false, error: { code: "tint.wire_cycle" } });
    expect(clip().grade).toEqual(before);
  });

  it("a free rewire seals only the region it touches", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push((await ok<{ nodeId: string }>(addCorrection, { target })).nodeId);
    }
    const [x, a, b, c, y] = ids as [string, string, string, string, string];
    const before = clip().grade;
    // c feeds two joins that rejoin at different points: no shape Baby Seal knows.
    const parallel = (inputs: string[]) => ({
      kind: "parallel",
      inputs: inputs.map((node) => ({ node })),
      on: true,
      opacity: 1,
    });
    await ok(wire, {
      target,
      add: [
        { id: "p1", node: parallel([b, c]) },
        { id: "p2", node: parallel(["p1", c]) },
      ],
      set: [
        { nodeId: c, input: { node: a } },
        { nodeId: y, input: { node: "p2" } },
      ],
    });
    const items = toStack(clip().grade ?? null);
    expect(items.map((item) => item.type)).toEqual(["layer", "layer", "sealed", "layer"]);
    expect(items[0]).toMatchObject({ id: x });
    expect(items[1]).toMatchObject({ id: a });
    expect(new Set((items[2] as { nodes: string[] }).nodes)).toEqual(new Set([b, c, "p1", "p2"]));
    expect(items[3]).toMatchObject({ id: y });
    kernel.history.undo();
    expect(clip().grade).toEqual(before);
  });

  it("makes, grades, moves and leaves a shot group, deleting it once nobody is in it", async () => {
    const other = (await ok<{ clips: { id: string }[] }>(addClip, { mediaId: "mv", start: 20 * S }))
      .clips[0]!.id;
    const { groupId: g1 } = await ok<{ groupId: string }>(setShotGroup, {
      clipIds: [clipId, other],
      group: { name: "Plaza" },
    });
    expect(doc().gradeGroups?.[g1]).toEqual({ id: g1, name: "Plaza" });
    expect(clip().gradeGroup).toBe(g1);
    const { nodeId } = await ok<{ nodeId: string }>(addCorrection, { target: { groupId: g1 } });
    expect(doc().gradeGroups?.[g1]?.grade?.out).toEqual({ node: nodeId });
    expect("grade" in clip()).toBe(false);
    const { groupId: g2 } = await ok<{ groupId: string }>(setShotGroup, {
      clipIds: [clipId],
      group: { name: "Wide" },
    });
    expect(doc().gradeGroups?.[g1]).toBeDefined();
    const moved = await run(setShotGroup, { clipIds: [other], group: { id: g2 } });
    expect(moved.ok).toBe(true);
    expect(doc().gradeGroups?.[g1]).toBeUndefined();
    await ok(setShotGroup, { clipIds: [clipId, other], group: null });
    expect(doc().gradeGroups).toBeUndefined();
    expect("gradeGroup" in clip()).toBe(false);
    const missing = await run(setShotGroup, { clipIds: [clipId], group: { id: g1 } });
    expect(!missing.ok && missing.error.code).toBe("tint.target_not_found");
    kernel.history.undo();
    kernel.history.undo();
    expect(doc().gradeGroups?.[g1]?.grade?.out).toEqual({ node: nodeId });
    expect(doc().clips[other]?.gradeGroup).toBe(g1);
  });
});

describe("paste part", () => {
  // tintRef is not loaded here (the module needs workspace), so the clipboard commands are tested through their logic.
  it("pastes only Basics into the matching corrections, adding one when missing", () => {
    const layer = (values: object): Correction => ({
      kind: "correct",
      input: { node: "source" },
      on: true,
      opacity: 1,
      values,
    });
    const build = (all: object[]) =>
      all.reduce<ClipGrade>(
        (grade, values, i) => insertLayer(grade, {}, `n${i}`, layer(values)),
        emptyGrade(),
      );
    const source = build([{ exposure: 1, gain: { x: 0.2, y: 0, m: 0 } }, { saturation: 0.5 }]);
    let n = 0;
    const { grade } = pastePart(
      build([{ contrast: 1.2, exposure: -1 }]),
      source,
      ["basics"],
      () => `new${n++}`,
    );
    const [first, second] = toStack(grade).map((item) => grade.nodes[item.id]);
    expect(first).toMatchObject({ values: { exposure: 1 } });
    expect(first).not.toHaveProperty("values.contrast");
    expect(first).not.toHaveProperty("values.gain");
    expect(second).toMatchObject({ values: { saturation: 0.5 } });
    expect(Object.keys(grade.nodes)).toHaveLength(2);
  });
});

describe("grade versions", () => {
  it("switching versions swaps the grade and its key tracks in one undo step", async () => {
    const a = (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId;
    const track = (id: string) =>
      ({
        [`grade.nodes.${id}.values.exposure`]: { keys: [] },
        "transform.x": { keys: [] },
      }) as never;
    store().api.setState((s) => ({
      clips: { ...s.clips, [clipId]: { ...s.clips[clipId]!, animation: track(a) } },
    }));
    await ok(setVersion, { clipIds: [clipId], action: "create", name: "B" });
    // Edit the showing version A: drop its node and track, grade a new node with its own track.
    await ok(removeNodes, { target, nodeIds: [a] });
    const b = (await ok<{ nodeId: string }>(addCorrection, { target })).nodeId;
    store().api.setState((s) => ({
      clips: { ...s.clips, [clipId]: { ...s.clips[clipId]!, animation: track(b) } },
    }));
    const before = structuredClone(clip());
    await ok(setVersion, { clipIds: [clipId], action: "switch", name: "B" });
    expect(Object.keys(clip().grade!.nodes)).toEqual([a]);
    expect(Object.keys(clip().animation!).sort()).toEqual(
      ["transform.x", `grade.nodes.${a}.values.exposure`].sort(),
    );
    expect(clip().gradeVersion).toBe("B");
    expect(Object.keys(clip().gradeVersions!)).toEqual(["A"]);
    expect(Object.keys(clip().gradeVersions!.A!.animation!)).toEqual([
      `grade.nodes.${b}.values.exposure`,
    ]);
    kernel.history.undo();
    expect(clip()).toEqual(before);
    const dup = await run(setVersion, { clipIds: [clipId], action: "create", name: "B" });
    expect(dup).toMatchObject({ ok: false, error: { code: "tint.version_exists" } });
    const gone = await run(setVersion, { clipIds: [clipId], action: "delete", name: "A" });
    expect(gone).toMatchObject({ ok: false, error: { code: "tint.version_active" } });
  });
});

function store() {
  return kernel.modules.require(projectRef).store;
}
