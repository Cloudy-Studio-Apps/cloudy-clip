import { Scissors } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Logger, type PointReader } from "@/core";
import { elementModule, prop } from "@/modules/element";
import { createEmptyProject, createProjectModule, type Junction } from "@/modules/project";
import { defineJunctionKind } from "./logic/define";
import { junctionKinds } from "./junction.points";
import { junctionModule } from "./junction.module";
import { junctionRef } from "./junction.ref";
import { createJunctionApi } from "./junction.registry";

const testKind = defineJunctionKind({
  kind: "test.fade",
  name: "Fade",
  icon: Scissors,
  tracks: ["video"],
  properties: { amount: prop.number({ min: 0, max: 1 }), mode: prop.enum(["a", "b"]) },
  defaults: () => ({ amount: 0.5, mode: "a" }),
  overlap: false,
});

const testModule = defineModule({
  ref: defineModuleRef<Record<string, never>>("junction-test"),
  name: "junction-test",
  tier: "feature",
  requires: ["junction"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(junctionKinds, testKind);
    return { api: {} };
  },
});

async function load(...extra: (typeof testModule)[]) {
  const project = createEmptyProject();
  const kernel = await createKernel();
  await kernel.modules.loadAll([
    createProjectModule(project),
    elementModule,
    junctionModule,
    ...extra,
  ]);
  return { kernel, api: kernel.modules.require(junctionRef), format: project.format };
}

const junction = (kind: string, props: Record<string, unknown> = {}): Junction => ({
  id: "j1",
  kind,
  trackId: "t1",
  leftClipId: "a",
  rightClipId: "b",
  duration: 0,
  props,
});

describe("junction registry", () => {
  it("get returns a contributed kind with its patch schema", async () => {
    const { api } = await load(testModule);
    const resolved = api.get("test.fade");
    expect(resolved?.definition.name).toBe("Fade");
    expect(resolved?.schema.safeParse({ amount: 0.2 }).success).toBe(true);
    expect(resolved?.schema.safeParse({ amount: 3 }).success).toBe(false);
    expect(resolved?.schema.safeParse({ nope: 1 }).success).toBe(false);
    expect(api.list()).toHaveLength(1);
  });

  it("resolve merges stored props over defaults", async () => {
    const { api, format } = await load(testModule);
    expect(api.resolve(junction("test.fade", { mode: "b" }), format)).toEqual({
      amount: 0.5,
      mode: "b",
    });
    expect(api.resolve(junction("gone", { mode: "b" }), format)).toEqual({});
  });

  it("display of an unregistered kind says not available and warns once", () => {
    const warn = vi.fn();
    const log: Logger = { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() };
    const points: PointReader = {
      get: () => [],
      find: () => undefined,
      subscribe: () => () => {},
    };
    const api = createJunctionApi(points, log);
    const format = createEmptyProject().format;
    const first = api.display(junction("ghost"), format);
    api.display(junction("ghost"), format);
    expect(first.label).toBe("ghost (not available)");
    expect(first.missing).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("cache is rebuilt when a kind is contributed after load", async () => {
    const { kernel, api } = await load();
    expect(api.get("test.fade")).toBeUndefined();
    await kernel.modules.loadAll([testModule]);
    expect(api.get("test.fade")?.definition).toBe(testKind);
  });
});
