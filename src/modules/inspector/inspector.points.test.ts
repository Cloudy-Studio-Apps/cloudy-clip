import { describe, expect, it } from "vitest";
import { createKernel, defineModule, defineModuleRef } from "@/core";
import { createEmptyProject, createProjectModule, type Clip, type Track } from "@/modules/project";
import { createFakeFontsModule } from "@/modules/fonts";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import { timelineModule } from "@/modules/timeline";
import { inspectorModule } from "./inspector.module";
import { inspectorSections } from "./inspector.points";

const testRef = defineModuleRef<Record<string, never>>("inspector-test");
const Body = () => null;

const testModule = defineModule({
  ref: testRef,
  name: "Test",
  tier: "feature",
  requires: ["inspector"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(inspectorSections, {
      id: "test.video",
      title: "Video only",
      order: 100,
      appliesTo: (_clip: Clip, track: Track) => track.kind === "video",
      component: Body,
    });
    contribute(inspectorSections, {
      id: "test.any",
      title: "Any",
      order: 10,
      appliesTo: () => true,
      component: Body,
    });
    return { api: {} };
  },
});

describe("inspector.sections", () => {
  it("returns contributed sections and appliesTo filters by track kind", async () => {
    const kernel = await createKernel();
    await kernel.modules.loadAll([
      createProjectModule(createEmptyProject()),
      createFakeMediaModule({}),
      createFakeFontsModule(),
      previewModule,
      timelineModule,
      inspectorModule,
      testModule,
    ]);
    const sections = kernel.points.get(inspectorSections);
    expect(sections.map((s) => s.id).sort()).toEqual(["test.any", "test.video"]);
    const clip = {} as Clip;
    const forKind = (kind: Track["kind"]) =>
      sections.filter((s) => s.appliesTo(clip, { kind } as Track)).map((s) => s.id);
    expect(forKind("video")).toContain("test.video");
    expect(forKind("audio")).not.toContain("test.video");
    expect(forKind("audio")).toEqual(["test.any"]);
  });
});
