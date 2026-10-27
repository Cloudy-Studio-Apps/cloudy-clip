import { describe, expect, it } from "vitest";
import { createKernel } from "@/core";
import { setFormat } from "./project.commands";
import { createProjectModule } from "./project.module";
import { projectRef } from "./project.ref";

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
    expect(a.modules.require(projectRef).store.getState().format.width).toBe(1920);
    expect(b.modules.require(projectRef).store.getState().format).toMatchObject({
      width: 1080,
      height: 1920,
    });
  });

  it("undo restores an agent's edit on the kernel's own project", async () => {
    const kernel = await kernelWithProject();
    await kernel.bus.run(setFormat, { preset: "16:9" }, { origin: "agent" });
    await kernel.bus.execute("history.undo", {});
    expect(kernel.modules.require(projectRef).store.getState().format).toMatchObject({
      width: 1080,
      height: 1920,
    });
  });
});
