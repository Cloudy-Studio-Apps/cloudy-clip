import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { elementModule } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import { createProjectModule, projectRef, seedProject } from "@/modules/project";
import { addElement, timelineModule } from "@/modules/timeline";
import { transformModule } from "@/modules/transform";
import { createSolid, removeSolid } from "./solid.commands";
import { solidModule } from "./solid.module";

let kernel: Kernel;
const doc = () => kernel.modules.require(projectRef).store.getState();

beforeEach(async () => {
  kernel = await createKernel();
  await kernel.modules.loadAll([
    createProjectModule(seedProject()),
    elementModule,
    junctionModule,
    createFakeMediaModule({}),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
    transformModule,
    solidModule,
  ]);
});

describe("solid colors", () => {
  it("a clip keeps its colour after its library solid is removed", async () => {
    const made = await kernel.bus.run(createSolid, {
      name: "Night",
      color: "#112233",
      width: 1920,
      height: 1080,
    });
    if (!made.ok) throw new Error(made.error.code);
    const solid = doc().solids[made.value.solidId]!;
    const { color, width, height } = solid;
    const placed = await kernel.bus.run(addElement, {
      kind: "solid",
      props: { color, width, height },
    });
    if (!placed.ok) throw new Error(placed.error.code);

    await kernel.bus.run(removeSolid, { solidId: solid.id });
    expect(doc().solids[solid.id]).toBeUndefined();
    expect(doc().clips[placed.value.id]!.props.color).toBe("#112233");
  });
});
