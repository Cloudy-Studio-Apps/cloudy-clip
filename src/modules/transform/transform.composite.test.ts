import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { elementModule, setProps } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import { createProjectModule, projectRef, seedProject } from "@/modules/project";
import { addElement, timelineModule } from "@/modules/timeline";
import { solidModule } from "@/modules/solid";
import { transformModule } from "./transform.module";

let kernel: Kernel;
let clipId: string;
const clip = () => kernel.modules.require(projectRef).store.getState().clips[clipId]!;

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
  const added = await kernel.bus.run(addElement, { kind: "solid" });
  if (!added.ok) throw new Error(added.error.code);
  clipId = added.value.id;
});

describe("composite", () => {
  it("stores a mode and opacity, and nothing once they are back to Normal at 100%", async () => {
    await kernel.bus.run(setProps, {
      clipIds: [clipId],
      patch: { composite: { mode: "multiply", opacity: 0.5 } },
    });
    expect(clip().composite).toEqual({ mode: "multiply", opacity: 0.5 });

    await kernel.bus.run(setProps, {
      clipIds: [clipId],
      patch: { composite: { mode: "normal", opacity: 1 } },
    });
    expect(clip().composite).toBeUndefined();
  });

  it("refuses a mode that doesn't exist", async () => {
    const result = await kernel.bus.run(setProps, {
      clipIds: [clipId],
      patch: { composite: { mode: "subtract" } },
    });
    expect(result.ok ? "" : result.error.code).toBe("element.invalid_props");
  });
});
