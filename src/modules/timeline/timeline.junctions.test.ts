import { Scissors } from "lucide-react";
import { describe, expect, it } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import { elementModule, prop } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { addJunction, defineJunctionKind, junctionKinds, junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import {
  seedProject,
  createProjectModule,
  projectRef,
  staleJunctions,
  type Clip,
  type Junction,
  type ProjectState,
} from "@/modules/project";
import {
  deleteClips,
  moveClip,
  removeTrack,
  rippleDelete,
  splitAt,
  trimClip,
  unlinkClips,
} from "./timeline.commands";
import { timelineModule } from "./timeline.module";

const S = 1_000_000;

const overlapping = defineJunctionKind({
  kind: "test.dissolve",
  name: "Dissolve",
  icon: Scissors,
  tracks: ["video"],
  properties: { amount: prop.number({ min: 0, max: 1 }) },
  defaults: () => ({ amount: 0.5 }),
  overlap: {
    default: 500_000,
    min: () => 100_000,
    max: (l, r) => Math.floor(Math.min(l.duration, r.duration) / 2),
  },
});

const kindsModule = defineModule({
  ref: defineModuleRef<Record<string, never>>("timeline-junction-kinds-test"),
  name: "kinds",
  tier: "feature",
  requires: ["junction"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(junctionKinds, overlapping);
    return { api: {} };
  },
});

let kernel: Kernel;
let trackV: string;
const doc = () => kernel.modules.require(projectRef).store.getState();
const frame = () => Math.ceil(S / doc().compositions.c1!.format.fps);

const clip = (
  id: string,
  trackId: string,
  start: number,
  duration: number,
  linkId?: string,
): Clip => ({
  id,
  trackId,
  kind: "media",
  props: {},
  start,
  sourceIn: 0,
  duration,
  ...(linkId && { linkId }),
});

/** V1: A [0,4) B [4,8) C [8,10); sounds sA sB sC linked on A1. */
function project(): ProjectState {
  const s = seedProject();
  trackV = s.compositions.c1!.trackOrder[0]!;
  const trackA = s.compositions.c1!.trackOrder[1]!;
  const rows: [string, number, number][] = [
    ["A", 0, 4],
    ["B", 4, 4],
    ["C", 8, 2],
  ];
  for (const [id, start, dur] of rows) {
    s.clips[id] = clip(id, trackV, start * S, dur * S, `l${id}`);
    s.clips[`s${id}`] = clip(`s${id}`, trackA, start * S, dur * S, `l${id}`);
    s.tracks[trackV]!.clipIds.push(id);
    s.tracks[trackA]!.clipIds.push(`s${id}`);
  }
  return s;
}

/** Moves a clip and its sound in the initial project (before any junction). */
function place(s: ProjectState, id: string, start: number) {
  s.clips[id]!.start = start;
  s.clips[`s${id}`]!.start = start;
}

const starts = () => Object.fromEntries(Object.values(doc().clips).map((c) => [c.id, c.start / S]));

async function load(change?: (state: ProjectState) => void) {
  kernel = await createKernel();
  const initial = project();
  change?.(initial);
  await kernel.modules.loadAll([
    createProjectModule(initial),
    elementModule,
    junctionModule,
    kindsModule,
    createFakeMediaModule({}),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
  ]);
}

async function run<T>(
  promise: Promise<{ ok: true; value: T } | { ok: false; error: { code: string } }>,
) {
  const result = await promise;
  if (!result.ok) throw new Error(`command failed: ${result.error.code}`);
  return result.value;
}

/** Loads the fixture and joins A and B with a 0.5 s dissolve: B, C and sounds 0.5 s earlier. */
async function joined(change?: (state: ProjectState) => void): Promise<Junction> {
  await load(change);
  return run(
    kernel.bus.run(addJunction, {
      kind: "test.dissolve",
      leftClipId: "A",
      rightClipId: "B",
    } as never),
  ) as Promise<Junction>;
}

describe("moving joined clips", () => {
  it("moving A and B together keeps the junction", async () => {
    // A and B (and their sounds) share one link, already joined by a 0.5 s junction.
    await load((s) => {
      for (const id of ["A", "sA", "B", "sB"]) s.clips[id]!.linkId = "lAB";
      place(s, "B", 3.5 * S);
      place(s, "C", 9 * S);
      s.junctions.j = {
        id: "j",
        kind: "test.dissolve",
        trackId: trackV,
        leftClipId: "A",
        rightClipId: "B",
        duration: 0.5 * S,
        props: {},
      };
    });
    const moved = await run(kernel.bus.run(moveClip, { clipId: "A", start: S }));
    expect(moved.removedJunctions).toEqual([]);
    expect(starts()).toMatchObject({ A: 1, B: 4.5, sA: 1, sB: 4.5, C: 9 });
    expect(doc().junctions.j!.duration).toBe(0.5 * S);
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("nudging B right by one frame shrinks the junction by one frame", async () => {
    const j = await joined((s) => place(s, "C", 9 * S));
    const moved = await run(kernel.bus.run(moveClip, { clipId: "B", start: 3.5 * S + frame() }));
    expect(moved.removedJunctions).toEqual([]);
    expect(doc().junctions[j.id]!.duration).toBe(0.5 * S - frame());
    expect(doc().clips.sB!.start).toBe(3.5 * S + frame());
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("nudging B left past the limit is refused with junction.invalid_duration", async () => {
    await joined();
    const before = doc();
    const result = await kernel.bus.run(moveClip, { clipId: "B", start: 1.5 * S });
    expect(!result.ok && result.error.code).toBe("junction.invalid_duration");
    expect(doc()).toBe(before);
  });

  it("moving B so it only touches A removes the junction", async () => {
    const j = await joined((s) => place(s, "C", 9 * S));
    const moved = await run(kernel.bus.run(moveClip, { clipId: "B", start: 4 * S }));
    expect(moved.removedJunctions).toEqual([j.id]);
    expect(doc().junctions).toEqual({});
    expect(starts()).toMatchObject({ A: 0, B: 4, sB: 4, C: 8.5 });
  });

  it("moving B away removes the junction and does not shift back", async () => {
    const j = await joined();
    const moved = await run(kernel.bus.run(moveClip, { clipId: "B", start: 20 * S }));
    expect(moved.removedJunctions).toEqual([j.id]);
    expect(doc().junctions).toEqual({});
    expect(starts()).toEqual({ A: 0, B: 20, C: 7.5, sA: 0, sB: 20, sC: 7.5 });
  });

  it("keeps a junction of an unregistered kind and skips its limits", async () => {
    await load((s) => {
      place(s, "B", 3.5 * S);
      place(s, "C", 9 * S);
      s.junctions.j = {
        id: "j",
        kind: "plugin.missing",
        trackId: trackV,
        leftClipId: "A",
        rightClipId: "B",
        duration: 0.5 * S,
        props: {},
      };
    });
    await run(kernel.bus.run(moveClip, { clipId: "B", start: 1 * S }));
    expect(doc().junctions.j!.duration).toBe(3 * S);
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("undo restores the clips and the junction", async () => {
    await joined();
    const before = doc();
    await run(kernel.bus.run(moveClip, { clipId: "B", start: 20 * S }));
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });
});

describe("trimming joined clips", () => {
  it("trimming A's end ripples B, C and sounds and keeps the overlap", async () => {
    const j = await joined();
    await run(kernel.bus.run(trimClip, { clipId: "A", edge: "end", time: 3 * S }));
    expect(starts()).toEqual({ A: 0, B: 2.5, C: 6.5, sA: 0, sB: 2.5, sC: 6.5 });
    expect(doc().clips.A!.duration).toBe(3 * S);
    expect(doc().clips.sA!.duration).toBe(3 * S);
    expect(doc().junctions[j.id]!.duration).toBe(0.5 * S);
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("trimming B's start ripples B back so the overlap stays", async () => {
    const j = await joined();
    await run(kernel.bus.run(trimClip, { clipId: "B", edge: "start", time: 4.5 * S }));
    expect(doc().clips.B).toMatchObject({ start: 3.5 * S, duration: 3 * S });
    expect(starts()).toMatchObject({ C: 6.5, sB: 3.5, sC: 6.5 });
    expect(doc().junctions[j.id]!.duration).toBe(0.5 * S);
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("trimming B shorter than 2·d shrinks d to the new max", async () => {
    const j = await joined();
    await run(kernel.bus.run(trimClip, { clipId: "B", edge: "end", time: 4.3 * S }));
    expect(doc().junctions[j.id]!.duration).toBe(0.4 * S);
    expect(doc().clips.B).toMatchObject({ start: 3.6 * S, duration: 0.8 * S });
    expect(starts()).toMatchObject({ sB: 3.6, C: 7.6, sC: 7.6 });
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("extending A's end ripples B, C and sounds later and keeps the overlap", async () => {
    const j = await joined();
    await run(kernel.bus.run(trimClip, { clipId: "A", edge: "end", time: 5 * S }));
    expect(starts()).toEqual({ A: 0, B: 4.5, C: 8.5, sA: 0, sB: 4.5, sC: 8.5 });
    expect(doc().clips.A!.duration).toBe(5 * S);
    expect(doc().clips.sA!.duration).toBe(5 * S);
    expect(doc().junctions[j.id]!.duration).toBe(0.5 * S);
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("extending B's start keeps B's start and ripples its end, C and sounds later", async () => {
    // B starts 1 s into its source, so it has 1 s of head to grow into.
    const j = await joined((s) => {
      s.clips.B!.sourceIn = S;
      s.clips.sB!.sourceIn = S;
      s.clips.B!.mediaId = "m";
      s.clips.sB!.mediaId = "m";
    });
    await run(kernel.bus.run(trimClip, { clipId: "B", edge: "start", time: 2.5 * S }));
    expect(doc().clips.B).toMatchObject({ start: 3.5 * S, sourceIn: 0, duration: 5 * S });
    expect(doc().clips.sB).toMatchObject({ start: 3.5 * S, sourceIn: 0, duration: 5 * S });
    expect(starts()).toMatchObject({ A: 0, C: 8.5, sC: 8.5 });
    expect(doc().junctions[j.id]!.duration).toBe(0.5 * S);
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("extending a joined edge into an unlinked clip is refused", async () => {
    await joined((s) => {
      s.clips.X = clip("X", s.compositions.c1!.trackOrder[1]!, 12 * S, S);
      s.tracks[s.compositions.c1!.trackOrder[1]!]!.clipIds.push("X");
    });
    const before = doc();
    const result = await kernel.bus.run(trimClip, { clipId: "A", edge: "end", time: 7 * S });
    expect(!result.ok && result.error.code).toBe("timeline.overlap");
    expect(doc()).toBe(before);
  });
});

describe("unlinking joined clips", () => {
  it("unlinking A while its sound overlaps B's under the junction fails, changing nothing", async () => {
    await joined();
    const before = doc();
    const result = await kernel.bus.run(unlinkClips, { clipIds: ["A"] });
    expect(!result.ok && result.error.code).toBe("timeline.unlink_joined");
    expect(doc()).toBe(before);
  });

  it("a sound-only delete of a sound that overlaps under the junction fails the same way, changing nothing", async () => {
    await joined();
    const before = doc();
    const result = await kernel.bus.run(deleteClips, { clipIds: ["sA"], soundOnly: true });
    expect(!result.ok && result.error.code).toBe("timeline.unlink_joined");
    expect(doc()).toBe(before);
  });
});

describe("splitting and deleting joined clips", () => {
  it("splitting A before the overlap re-points the junction to the right half", async () => {
    const j = await joined();
    const { created } = await run(kernel.bus.run(splitAt, { at: 2 * S, clipIds: ["A"] }));
    const rightHalf = created.find((id) => doc().clips[id]!.trackId === trackV)!;
    expect(doc().junctions[j.id]).toMatchObject({ leftClipId: rightHalf, rightClipId: "B" });
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("splitting B after the overlap keeps the junction on its left half", async () => {
    const j = await joined();
    await run(kernel.bus.run(splitAt, { at: 6 * S, clipIds: ["B"] }));
    expect(doc().junctions[j.id]).toMatchObject({ leftClipId: "A", rightClipId: "B" });
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("splitting inside the overlap fails with junction.split_in_overlap", async () => {
    await joined();
    const before = doc();
    const result = await kernel.bus.run(splitAt, { at: 3.75 * S, clipIds: ["A"] });
    expect(!result.ok && result.error.code).toBe("junction.split_in_overlap");
    expect(doc()).toBe(before);
  });

  it("splitting everything under the playhead skips clips in an overlap", async () => {
    await joined((s) => {
      s.tracks.V2 = { ...s.tracks[trackV]!, id: "V2", name: "V2", clipIds: ["X"] };
      s.compositions.c1!.trackOrder.unshift("V2");
      s.clips.X = clip("X", "V2", 0, 10 * S);
    });
    const { created } = await run(kernel.bus.run(splitAt, { at: 3.75 * S }));
    expect(created).toHaveLength(1);
    expect(doc().clips[created[0]!]!.trackId).toBe("V2");
    expect(doc().clips.A!.duration).toBe(4 * S);
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("deleting A removes the junction and leaves B in place", async () => {
    const j = await joined();
    const result = await run(kernel.bus.run(deleteClips, { clipIds: ["A"] }));
    expect(result.removedJunctions).toEqual([j.id]);
    expect(doc().junctions).toEqual({});
    expect(starts()).toEqual({ B: 3.5, C: 7.5, sB: 3.5, sC: 7.5 });
    expect(staleJunctions(doc())).toEqual([]);
  });
});

describe("ripple deleting joined clips", () => {
  it("closes only the time the clip freed, and removes its junction", async () => {
    await joined();
    await run(kernel.bus.run(rippleDelete, { clipIds: ["B"] }));
    expect(doc().clips.C!.start).toBe(4 * S);
    expect(doc().clips.sC!.start).toBe(4 * S);
    expect(doc().junctions).toEqual({});
    expect(staleJunctions(doc())).toEqual([]);
  });
});

describe("removing tracks with joined clips", () => {
  it("refuses to remove the picture track while linked sounds still overlap", async () => {
    await joined();
    const before = doc();
    const result = await kernel.bus.run(removeTrack, { trackId: trackV });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("timeline.remove_joined");
    expect(doc()).toBe(before);
  });

  it("removes a track whose joined clips have no linked sounds, with its junction", async () => {
    const j = await joined((s) => {
      for (const c of Object.values(s.clips)) delete c.linkId;
      for (const id of ["sA", "sB", "sC"]) delete s.clips[id];
      s.tracks[s.compositions.c1!.trackOrder[1]!]!.clipIds = [];
    });
    const result = await run(kernel.bus.run(removeTrack, { trackId: trackV }));
    expect(result.removedJunctions).toEqual([j.id]);
    expect(doc().tracks[trackV]).toBeUndefined();
    expect(doc().junctions).toEqual({});
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("removes the audio track and keeps the junction of the pictures", async () => {
    const j = await joined();
    const audio = doc().compositions.c1!.trackOrder[1]!;
    const result = await run(kernel.bus.run(removeTrack, { trackId: audio }));
    expect(result.removedJunctions).toEqual([]);
    expect(Object.keys(doc().junctions)).toEqual([j.id]);
    expect(staleJunctions(doc())).toEqual([]);
  });
});
