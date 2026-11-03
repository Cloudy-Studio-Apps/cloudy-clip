import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, LOCAL_ACTOR, type Kernel } from "@/core";
import { compositionModule } from "@/modules/composition";
import { elementModule } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule, previewRef } from "@/modules/preview";
import { createProjectModule, projectRef, seedProject } from "@/modules/project";
import { timelineModule } from "@/modules/timeline";
import { addMarker } from "./marker.commands";
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
});
