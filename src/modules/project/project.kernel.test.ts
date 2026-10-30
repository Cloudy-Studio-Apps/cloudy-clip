import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createKernel, defineCommand, LOCAL_ACTOR, type Kernel } from "@/core";
import { createProjectModule } from "./project.module";
import { projectRef } from "./project.ref";
import { seedProject } from "./project.testing";

const widen = defineCommand({
  id: "test.widen",
  label: "Widen",
  description: "Sets the open composition's width.",
  undoable: true,
  input: z.object({ width: z.number() }),
  run(ctx, { width }) {
    const { store, view } = ctx.require(projectRef);
    const { id } = view.requireOpen(ctx.actor);
    ctx.mutate(store, (draft) => {
      draft.compositions[id]!.format.width = width;
    });
  },
});

const width = (kernel: Kernel) => {
  const { store, view } = kernel.modules.require(projectRef);
  return store.getState().compositions[view.openFor(LOCAL_ACTOR)!]!.format.width;
};

async function kernelWithProject() {
  const kernel = await createKernel();
  await kernel.modules.load(createProjectModule(seedProject()));
  kernel.bus.register(widen);
  return kernel;
}

describe("project per kernel", () => {
  it("two kernels have independent projects", async () => {
    const a = await kernelWithProject();
    const b = await kernelWithProject();
    await a.bus.run(widen, { width: 1920 });
    expect(width(a)).toBe(1920);
    expect(width(b)).toBe(1080);
  });

  it("undo restores an agent's edit on the kernel's own project", async () => {
    const kernel = await kernelWithProject();
    await kernel.bus.run(widen, { width: 1920 }, { origin: "agent" });
    await kernel.bus.execute("history.undo", {});
    expect(width(kernel)).toBe(1080);
  });
});
