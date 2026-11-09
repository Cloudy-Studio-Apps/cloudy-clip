import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { elementModule } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import { createProjectModule, projectRef, seedProject } from "@/modules/project";
import { addClip, timelineModule } from "@/modules/timeline";
import { resetGrade } from "./tint.commands";
import { addCorrection, moveLayer, removeNodes, setCorrection } from "./tint.node.commands";
import { tintModule } from "./tint.module";
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
    await ok(resetGrade, { target, fields: ["exposure"], nodeId: b.nodeId });
    expect((clip().grade!.nodes as typeof nodes)[b.nodeId]!.values).toBeUndefined();
    const before = clip().grade;
    await ok(setCorrection, { target, nodeId: b.nodeId, patch: { values: {} } });
    await ok(resetGrade, { target, tools: ["wheels"], nodeId: b.nodeId });
    expect(clip().grade).toBe(before);
  });
});

function store() {
  return kernel.modules.require(projectRef).store;
}
