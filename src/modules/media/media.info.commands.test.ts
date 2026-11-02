import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { createProjectModule, projectRef, seedProject } from "@/modules/project";
import { renameMedia, setInfo } from "./media.info.commands";
import { createFakeMediaModule } from "./media.testing";

let kernel: Kernel;
const doc = () => kernel.modules.require(projectRef).store.getState();

beforeEach(async () => {
  kernel = await createKernel();
  const project = seedProject();
  project.media.a = { id: "a", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 };
  project.mediaOrder = ["a"];
  await kernel.modules.loadAll([createProjectModule(project), createFakeMediaModule({})]);
});

describe("media info", () => {
  it("setInfo merges, clears with null, and undoes in one step", async () => {
    await kernel.bus.run(setInfo, { mediaId: "a", patch: { scene: "1", tag: "good" } });
    await kernel.bus.run(setInfo, { mediaId: "a", patch: { take: "3", tag: null } });
    expect(doc().media.a!.info).toEqual({ scene: "1", take: "3" });

    await kernel.bus.execute("history.undo", {});
    expect(doc().media.a!.info).toEqual({ scene: "1", tag: "good" });
  });

  it("renames a file without touching its path", async () => {
    await kernel.bus.run(renameMedia, { mediaId: "a", name: "Seal" });
    expect(doc().media.a).toMatchObject({ name: "Seal", path: "/a.mp4" });
  });
});
