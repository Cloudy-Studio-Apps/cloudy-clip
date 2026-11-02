import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { compositionModule, setSettings } from "@/modules/composition";
import { elementModule, elementRef } from "@/modules/element";
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
    compositionModule,
    transformModule,
    solidModule,
  ]);
});

const wide = { width: 1280, height: 720, fps: 30 };

async function addSolid(props?: Record<string, unknown>) {
  const placed = await kernel.bus.run(addElement, { kind: "solid", ...(props && { props }) });
  if (!placed.ok) throw new Error(placed.error.code);
  return placed.value.id;
}

describe("a solid on the timeline", () => {
  it("follows the frame while it stores no size", async () => {
    const id = await addSolid();
    await kernel.bus.run(setSettings, { compositionId: "c1", format: wide, resize: "keep" });
    const clip = doc().clips[id]!;
    const values = kernel.modules.require(elementRef).resolve(clip, wide);
    expect([values.width, values.height]).toEqual([1280, 720]);
    expect(clip.props.width).toBeUndefined();
  });

  it("isn't scaled twice when the composition is resized with scale", async () => {
    const id = await addSolid();
    await kernel.bus.run(setSettings, { compositionId: "c1", format: wide, resize: "scale" });
    expect(doc().clips[id]!.transform).toBeUndefined();
  });

  it("keeps a size of its own, and scales with the composition", async () => {
    const id = await addSolid({ width: 500, height: 500 });
    await kernel.bus.run(setSettings, { compositionId: "c1", format: wide, resize: "scale" });
    const clip = doc().clips[id]!;
    expect(clip.props.width).toBe(500);
    expect(clip.transform?.scale).not.toBe(1);
  });
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
