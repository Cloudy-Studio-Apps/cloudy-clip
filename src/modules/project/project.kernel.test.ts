import { describe, expect, it } from "vitest";
import { createKernel, LOCAL_ACTOR, type Kernel } from "@/core";
import { setFormat } from "./project.commands";
import { createProjectModule } from "./project.module";
import { projectRef } from "./project.ref";

const format = (kernel: Kernel) => {
  const { store, view } = kernel.modules.require(projectRef);
  return store.getState().compositions[view.openFor(LOCAL_ACTOR)!]!.format;
};

async function kernelWithProject() {
  const kernel = await createKernel();
  await kernel.modules.load(createProjectModule());
  return kernel;
}

describe("project per kernel", () => {
  it("two kernels have independent projects", async () => {
    const a = await kernelWithProject();
    const b = await kernelWithProject();
    await a.bus.run(setFormat, { preset: "16:9" });
    expect(format(a).width).toBe(1920);
    expect(format(b)).toMatchObject({
      width: 1080,
      height: 1920,
    });
  });

  it("undo restores an agent's edit on the kernel's own project", async () => {
    const kernel = await kernelWithProject();
    await kernel.bus.run(setFormat, { preset: "16:9" }, { origin: "agent" });
    await kernel.bus.execute("history.undo", {});
    expect(format(kernel)).toMatchObject({
      width: 1080,
      height: 1920,
    });
  });
});
