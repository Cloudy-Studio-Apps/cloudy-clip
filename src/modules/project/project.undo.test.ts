import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createKernel,
  createPatchableStore,
  defineCommand,
  LOCAL_ACTOR,
  type Kernel,
  type PatchableStore,
} from "@/core";
import { createProjectStore } from "./project.store";
import type { Clip, ProjectState } from "./project.types";

const AGENT = "agent-1";

function clip(id: string, start: number, trackId = "t1"): Clip {
  return { id, kind: "text", trackId, start, sourceIn: 0, duration: 10, props: {} };
}

/** A project with `a` on `t1`, and a kernel to edit it as any actor. */
async function setup() {
  const kernel: Kernel = await createKernel();
  const store: PatchableStore<ProjectState> = createProjectStore({
    format: { width: 1080, height: 1920, fps: 30 },
    media: {},
    mediaOrder: [],
    tracks: {
      t1: { id: "t1", kind: "video", name: "1", clipIds: ["a"], muted: false, hidden: false },
      t2: { id: "t2", kind: "video", name: "2", clipIds: [], muted: false, hidden: false },
      t3: { id: "t3", kind: "video", name: "3", clipIds: [], muted: false, hidden: false },
    },
    trackOrder: ["t1", "t2", "t3"],
    clips: { a: clip("a", 0) },
    junctions: {},
  });
  const recipes: Array<(draft: ProjectState) => void> = [];
  const step = defineCommand({
    id: "test.step",
    label: "Step",
    description: "Runs a recipe.",
    undoable: true,
    input: z.object({ n: z.number() }),
    run: (ctx, { n }) => ctx.mutate(store, recipes[n]!),
  });
  kernel.bus.register(step);
  const edit = async (actor: string, recipe: (draft: ProjectState) => void, label = "Step") => {
    recipes.push(recipe);
    const result = await kernel.bus.run(step, { n: recipes.length - 1 }, { actor, label });
    expect(result.ok).toBe(true);
  };
  /** One step made of several `mutate` calls, like a command running nested commands. */
  const parts = defineCommand({
    id: "test.parts",
    label: "Parts",
    description: "Runs recipes as one step.",
    undoable: true,
    input: z.object({ from: z.number(), count: z.number() }),
    run(ctx, { from, count }) {
      for (let i = from; i < from + count; i++) ctx.mutate(store, recipes[i]!);
    },
  });
  kernel.bus.register(parts);
  const editParts = async (actor: string, ...steps: Array<(draft: ProjectState) => void>) => {
    const from = recipes.length;
    recipes.push(...steps);
    const result = await kernel.bus.run(parts, { from, count: steps.length }, { actor });
    expect(result.ok).toBe(true);
  };
  const addClip = (actor: string, c: Clip) =>
    edit(actor, (d) => {
      d.clips[c.id] = c;
      d.tracks[c.trackId]!.clipIds.push(c.id);
    });
  return {
    kernel,
    store,
    edit,
    editParts,
    addClip,
    history: kernel.history,
    state: () => store.getState(),
  };
}

describe("per-actor undo", () => {
  let t: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    t = await setup();
  });

  it("undoes an agent's older step past the user's newer one", async () => {
    await t.addClip(AGENT, clip("b", 20));
    await t.addClip(LOCAL_ACTOR, clip("c", 40));
    t.history.undo(AGENT);
    expect(t.state().clips.b).toBeUndefined();
    expect(t.state().tracks.t1!.clipIds).toEqual(["a", "c"]);
  });

  it("refuses when someone changed the same field afterwards, and changes nothing", async () => {
    await t.edit(AGENT, (d) => void (d.clips.a!.start = 5));
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.a!.start = 8), "Move clip");
    const before = t.state();
    expect(() => t.history.undo(AGENT)).toThrow(
      'Can\'t undo: Someone changed this afterwards ("Move clip")',
    );
    expect(t.state()).toBe(before);
  });

  it("names who changed it", async () => {
    t.history.nameActors((actor) => (actor === LOCAL_ACTOR ? "You" : "Claude Code"));
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.a!.start = 5));
    await t.edit(AGENT, (d) => void (d.clips.a!.start = 8), "Trim clip");
    expect(() => t.history.undo(LOCAL_ACTOR)).toThrow(
      'Can\'t undo: Claude Code changed this afterwards ("Trim clip")',
    );
  });

  it("lets different fields of one clip go separately", async () => {
    await t.edit(AGENT, (d) => void (d.clips.a!.props = { size: 2 }));
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.a!.start = 8));
    t.history.undo(AGENT);
    expect(t.state().clips.a).toMatchObject({ start: 8, props: {} });
  });

  it("clashes a created clip with a later edit of it", async () => {
    await t.addClip(AGENT, clip("b", 20));
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.b!.start = 30));
    expect(() => t.history.undo(AGENT)).toThrow(/Can't undo/);
    expect(t.state().clips.b).toBeDefined();
  });

  it("refuses an undo that leaves a bad document", async () => {
    await t.edit(AGENT, (d) => {
      d.tracks.t4 = {
        id: "t4",
        kind: "video",
        name: "4",
        clipIds: [],
        muted: false,
        hidden: false,
      };
      d.trackOrder.push("t4");
    });
    await t.edit(LOCAL_ACTOR, (d) => {
      d.clips.a!.trackId = "t4";
      d.tracks.t1!.clipIds = [];
      d.tracks.t4!.clipIds = ["a"];
    });
    const before = t.state();
    expect(() => t.history.undo(AGENT)).toThrow(/Can't undo: a clip would be left without/);
    expect(t.state()).toBe(before);
  });

  const addTrack4 = (d: ProjectState) => {
    d.tracks.t4 = { id: "t4", kind: "video", name: "4", clipIds: [], muted: false, hidden: false };
    d.trackOrder.push("t4");
  };

  it("refuses a step of several parts whole, changing nothing", async () => {
    await t.editParts(AGENT, addTrack4, (d) => {
      d.clips.b = clip("b", 20, "t4");
      d.tracks.t4!.clipIds.push("b");
    });
    await t.edit(LOCAL_ACTOR, (d) => {
      d.clips.c = clip("c", 60, "t4");
      d.tracks.t4!.clipIds.push("c");
    });
    const before = t.state();
    expect(() => t.history.undo(AGENT)).toThrow(/Can't undo/);
    expect(t.state()).toBe(before);
    expect(t.history.undoLabelOf(AGENT)).toBe("Parts");
  });

  it("judges a step of several parts by where it ends, not half-way", async () => {
    await t.addClip(LOCAL_ACTOR, clip("x", 40));
    await t.editParts(AGENT, addTrack4, (d) => {
      d.clips.b = clip("b", 20, "t4");
      d.tracks.t4!.clipIds.push("b");
    });
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.x!.start = 50));
    t.history.undo(AGENT);
    expect(t.state().tracks.t4).toBeUndefined();
    expect(t.state().clips.b).toBeUndefined();
  });

  it("restores a deleted track past a later step", async () => {
    await t.edit(AGENT, (d) => {
      delete d.tracks.t2;
      d.trackOrder = ["t1", "t3"];
    });
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.a!.start = 5));
    t.history.undo(AGENT);
    expect(t.state().tracks.t2).toMatchObject({ id: "t2", clipIds: [] });
    expect(t.state().trackOrder).toEqual(["t1", "t3", "t2"]);
  });

  it("redoes a created track past a later step", async () => {
    await t.edit(AGENT, addTrack4);
    t.history.undo(AGENT);
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.a!.start = 5));
    t.history.redo(AGENT);
    expect(t.state().tracks.t4).toMatchObject({ id: "t4", clipIds: [] });
  });

  it("a blocked step blocks that actor's older steps", async () => {
    await t.edit(AGENT, (d) => void (d.clips.a!.sourceIn = 1));
    await t.edit(AGENT, (d) => void (d.clips.a!.start = 5));
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.a!.start = 8));
    expect(() => t.history.undo(AGENT)).toThrow(/Can't undo/);
    expect(t.state().clips.a!.sourceIn).toBe(1);
  });

  it("uses field writes after an out-of-order undo, not stale patches", async () => {
    await t.addClip(LOCAL_ACTOR, clip("b", 20));
    await t.addClip(AGENT, clip("c", 40));
    await t.addClip(LOCAL_ACTOR, clip("d", 60));
    t.history.undo(AGENT);
    t.history.undo(LOCAL_ACTOR);
    expect(t.state().tracks.t1!.clipIds).toEqual(["a", "b"]);
    t.history.undo(LOCAL_ACTOR);
    expect(t.state().tracks.t1!.clipIds).toEqual(["a"]);
  });

  it("a whole-record replace doesn't bring back another actor's undone clip", async () => {
    await t.addClip(AGENT, clip("b", 20));
    await t.edit(LOCAL_ACTOR, (d) => {
      const track = d.tracks.t1!;
      d.tracks.t1 = { ...track, clipIds: [...track.clipIds], name: "renamed" };
    });
    t.history.undo(AGENT);
    t.history.undo(LOCAL_ACTOR);
    expect(t.state().tracks.t1).toMatchObject({ name: "1", clipIds: ["a"] });
  });

  it("an undo by the latest actor restores order exactly", async () => {
    await t.edit(LOCAL_ACTOR, (d) => {
      delete d.tracks.t2;
      d.trackOrder = ["t1", "t3"];
    });
    t.history.undo(LOCAL_ACTOR);
    expect(t.state().trackOrder).toEqual(["t1", "t2", "t3"]);
  });

  it("an unbroken undo and redo chain restores order exactly", async () => {
    await t.edit(LOCAL_ACTOR, (d) => {
      delete d.tracks.t2;
      d.trackOrder = ["t1", "t3"];
    });
    await t.edit(LOCAL_ACTOR, (d) => void (d.tracks.t1!.name = "x"));
    t.history.undo(LOCAL_ACTOR);
    t.history.undo(LOCAL_ACTOR);
    t.history.redo(LOCAL_ACTOR);
    t.history.redo(LOCAL_ACTOR);
    expect(t.state().trackOrder).toEqual(["t1", "t3"]);
    t.history.undo(LOCAL_ACTOR);
    t.history.undo(LOCAL_ACTOR);
    expect(t.state().trackOrder).toEqual(["t1", "t2", "t3"]);
  });

  it("redoes an out-of-order undo", async () => {
    await t.addClip(AGENT, clip("b", 20));
    await t.addClip(LOCAL_ACTOR, clip("c", 40));
    t.history.undo(AGENT);
    t.history.redo(AGENT);
    expect(t.state().tracks.t1!.clipIds).toEqual(["a", "b", "c"]);
  });

  it("refuses a redo when the field changed since", async () => {
    await t.edit(AGENT, (d) => void (d.clips.a!.start = 5));
    t.history.undo(AGENT);
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.a!.start = 8));
    expect(() => t.history.redo(AGENT)).toThrow(/Can't redo/);
    expect(t.state().clips.a!.start).toBe(8);
  });

  it("a new edit clears only its own actor's redo", async () => {
    await t.edit(AGENT, (d) => void (d.clips.a!.sourceIn = 1));
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.a!.start = 5));
    t.history.undo(AGENT);
    t.history.undo(LOCAL_ACTOR);
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.a!.duration = 7));
    expect(t.history.redo(LOCAL_ACTOR)).toBeNull();
    expect(t.history.redo(AGENT)?.actor).toBe(AGENT);
  });

  it("a step on a store with no policy can't go out of order", async () => {
    const plain = createPatchableStore("plain", { n: 0 });
    const bump = defineCommand({
      id: "test.bump",
      label: "Bump",
      description: "Bumps.",
      undoable: true,
      input: z.object({}),
      run: (ctx) => ctx.mutate(plain, (d) => void (d.n += 1)),
    });
    await t.kernel.bus.run(bump, {}, { actor: AGENT });
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.a!.start = 5));
    expect(() => t.history.undo(AGENT)).toThrow(/Can't undo/);
    expect(plain.getState().n).toBe(1);
  });

  it("reports the actor's own next step", async () => {
    await t.edit(AGENT, (d) => void (d.clips.a!.sourceIn = 1), "Trim");
    await t.edit(LOCAL_ACTOR, (d) => void (d.clips.a!.start = 5), "Move");
    expect(t.history.undoLabelOf(AGENT)).toBe("Trim");
    expect(t.history.undoLabelOf("nobody")).toBeNull();
  });
});
