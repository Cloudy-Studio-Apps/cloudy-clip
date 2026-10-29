import { describe, expect, it } from "vitest";
import { createKernel, defineModule, defineModuleRef } from "@/core";
import { elementModule } from "@/modules/element";
import { createEmptyProject, createProjectModule } from "@/modules/project";
import { createFakeFontsModule } from "@/modules/fonts";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import { timelineModule } from "@/modules/timeline";
import { inspectorModule } from "./inspector.module";
import { propertyControls, sectionLayouts } from "./inspector.points";

const Control = () => null;

const testModule = (id: string) =>
  defineModule({
    ref: defineModuleRef<Record<string, never>>(id),
    name: id,
    tier: "feature",
    requires: ["inspector"],
    commands: [],
    mcpTools: [],
    setup({ contribute }) {
      contribute(propertyControls, { id: "test.dial", for: "field", component: Control });
      return { api: {} };
    },
  });

async function load(...extra: ReturnType<typeof testModule>[]) {
  const kernel = await createKernel();
  const statuses = await kernel.modules.loadAll([
    createProjectModule(createEmptyProject()),
    elementModule,
    createFakeMediaModule({}),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
    inspectorModule,
    ...extra,
  ]);
  return { kernel, statuses };
}

describe("inspector points", () => {
  it("has the built-in controls and the section layout", async () => {
    const { kernel } = await load();
    const ids = kernel.points.get(propertyControls).map((c) => c.id);
    for (const id of [
      "text",
      "textarea",
      "number",
      "slider",
      "dial",
      "toggle",
      "icon-toggle",
      "color",
      "segmented",
      "select",
      "button",
    ]) {
      expect(ids).toContain(id);
    }
    expect(kernel.points.find(sectionLayouts, "section")).toBeDefined();
  });
  it("rejects a second control with the same id", async () => {
    const { statuses } = await load(testModule("first"), testModule("second"));
    expect(statuses.first).toBe("active");
    expect(statuses.second).toBe("failed");
  });
});
