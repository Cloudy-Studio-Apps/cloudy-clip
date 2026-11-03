import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, LOCAL_ACTOR, type Kernel } from "@/core";
import { compositionModule } from "@/modules/composition";
import { elementModule } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule, previewRef } from "@/modules/preview";
import {
  createProjectModule,
  createEmptyProject,
  projectRef,
  seedProject,
} from "@/modules/project";
import { timelineModule } from "@/modules/timeline";
import { addMarker, removeMarker, updateMarker } from "./marker.commands";
import { markerModule } from "./marker.module";

let kernel: Kernel;
const doc = () => kernel.modules.require(projectRef).store.getState();

async function load(state = seedProject()) {
  kernel = await createKernel();
  await kernel.modules.loadAll([
    createProjectModule(state),
    elementModule,
    junctionModule,
    createFakeMediaModule({}),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
    compositionModule,
    markerModule,
  ]);
}

async function run<I>(command: Parameters<Kernel["bus"]["run"]>[0], input: I) {
  return kernel.bus.run(command, input as never);
}

describe("marker commands", () => {
  beforeEach(() => load());

  it("adds at the playhead, on the start of the frame it shows", async () => {
    kernel.modules.require(previewRef).playback.seek(1_050_000);
    const added = await run(addMarker, {});
    if (!added.ok) throw new Error(added.error.code);
    const { markerId } = added.value as { markerId: string };
    // 30 fps: frames are 33 334 µs, so 1.05 s falls in the frame starting at 1 033 354.
    expect(doc().markers[markerId]).toMatchObject({ compositionId: "c1", time: 1_033_354 });
    kernel.history.undo(LOCAL_ACTOR);
    expect(doc().markers).toEqual({});
  });

  it("refuses an edit that changes nothing, and a removal with an unknown id", async () => {
    const added = await run(addMarker, { time: 0 });
    if (!added.ok) throw new Error(added.error.code);
    const { markerId } = added.value as { markerId: string };
    const nothing = await run(updateMarker, { markerId });
    expect(nothing.ok ? null : nothing.error.code).toBe("marker.nothing");
    const unknown = await run(removeMarker, { markerIds: [markerId, "gone"] });
    expect(unknown.ok ? null : unknown.error.code).toBe("marker.not_found");
    expect(doc().markers[markerId]).toBeDefined();
  });
});

it("needs an open composition when none is named", async () => {
  await load(createEmptyProject());
  const added = await run(addMarker, { time: 0 });
  expect(added.ok ? null : added.error.code).toBe("composition.none_open");
});
