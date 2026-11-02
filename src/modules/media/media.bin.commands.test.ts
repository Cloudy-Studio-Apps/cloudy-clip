import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { createProjectModule, projectRef, seedProject } from "@/modules/project";
import { createBin, deleteBin, moveToBin } from "./media.bin.commands";
import { createFakeMediaModule } from "./media.testing";

let kernel: Kernel;
const doc = () => kernel.modules.require(projectRef).store.getState();

async function bin(name: string, parentId?: string): Promise<string> {
  const result = await kernel.bus.run(createBin, { name, parentId });
  if (!result.ok) throw new Error(result.error.code);
  return result.value.binId;
}

beforeEach(async () => {
  kernel = await createKernel();
  const project = seedProject();
  project.media.a = { id: "a", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 };
  project.mediaOrder = ["a"];
  await kernel.modules.loadAll([createProjectModule(project), createFakeMediaModule({})]);
});

describe("bins", () => {
  it("moves a deleted bin's files and sub-bins to its parent, in one undo", async () => {
    const parent = await bin("Land");
    const child = await bin("Rocks", parent);
    await kernel.bus.run(moveToBin, { mediaIds: ["a"], binId: parent });

    await kernel.bus.run(deleteBin, { binId: parent });
    expect(doc().media.a!.binId).toBeUndefined();
    expect(doc().bins[child]!.parentId).toBeNull();
    expect(doc().binOrder).toEqual([child]);

    await kernel.bus.execute("history.undo", {});
    expect(doc().bins[parent]).toBeDefined();
    expect(doc().bins[child]!.parentId).toBe(parent);
    expect(doc().media.a!.binId).toBe(parent);
  });

  it("refuses a bin inside its own descendant", async () => {
    const parent = await bin("Land");
    const child = await bin("Rocks", parent);
    const result = await kernel.bus.run(moveToBin, { binIds: [parent], binId: child });
    expect(result).toMatchObject({ ok: false, error: { code: "media.bin_cycle" } });
  });

  it("refuses a bin that doesn't exist", async () => {
    const result = await kernel.bus.run(moveToBin, { mediaIds: ["a"], binId: "nope" });
    expect(result).toMatchObject({ ok: false, error: { code: "media.no_bin" } });
  });
});
