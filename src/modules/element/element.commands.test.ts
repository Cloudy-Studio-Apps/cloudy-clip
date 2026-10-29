import { beforeEach, describe, expect, it, vi } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import {
  createEmptyProject,
  createProjectModule,
  projectRef,
  type Clip,
  type ProjectState,
} from "@/modules/project";
import { Type } from "lucide-react";
import { resetProps, setProps } from "./element.commands";
import { elementModule } from "./element.module";
import { elements } from "./element.points";
import { elementRef } from "./element.ref";
import { createElementApi } from "./element.registry";
import { defineElement } from "./logic/define";
import { prop } from "./logic/props";

const note = defineElement({
  kind: "note",
  name: "Note",
  source: "none",
  tracks: ["video"],
  properties: {
    text: prop.string({ min: 1, trim: true }),
    size: prop.number({ min: 1, max: 100 }),
    locked: prop.number({ readOnly: true }),
    box: prop.group(
      { label: "Box", toggle: "on" },
      { on: prop.boolean(), pad: prop.number({ min: 0, max: 50 }) },
    ),
  },
  defaults: () => ({ text: "Hi", size: 10, locked: 1, box: { on: false, pad: 4 } }),
  display: () => ({ icon: Type, color: "clip-type", label: "Note", body: "none" }),
});
const other = defineElement({
  kind: "other",
  name: "Other",
  source: "none",
  tracks: ["video"],
  properties: {},
  defaults: () => ({}),
  display: () => ({ icon: Type, color: "clip-type", label: "Other", body: "none" }),
});

const testModule = defineModule({
  ref: defineModuleRef<Record<string, never>>("test"),
  name: "Test",
  tier: "feature",
  requires: ["element"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(elements, note, other);
    return { api: {} };
  },
});

const clip = (id: string, kind: string): Clip =>
  ({ id, kind, trackId: "v", start: 0, sourceIn: 0, duration: 1, props: {} }) as unknown as Clip;

let kernel: Kernel;
const doc = (): ProjectState => kernel.modules.require(projectRef).store.getState();
const props = (id = "n1") => (doc().clips[id] as unknown as { props: unknown }).props;
async function failCode(promise: Promise<{ ok: boolean; error?: { code: string } }>) {
  const result = await promise;
  return result.ok ? "ok" : result.error!.code;
}

beforeEach(async () => {
  kernel = await createKernel();
  const project = createEmptyProject();
  project.tracks.v = {
    id: "v",
    kind: "video",
    name: "V1",
    clipIds: [],
    muted: false,
    hidden: false,
  };
  project.trackOrder = ["v"];
  project.clips = {
    n1: clip("n1", "note"),
    n2: clip("n2", "note"),
    o1: clip("o1", "other"),
    g1: clip("g1", "ghost"),
  };
  await kernel.modules.loadAll([createProjectModule(project), elementModule, testModule]);
});

describe("element.setProps", () => {
  it("stores only what differs from the defaults", async () => {
    await kernel.bus.run(setProps, { clipIds: ["n1"], patch: { size: 20, box: { on: true } } });
    expect(props()).toEqual({ size: 20, box: { on: true } });
    await kernel.bus.run(setProps, { clipIds: ["n1"], patch: { size: 10, box: { on: false } } });
    expect(props()).toEqual({});
  });

  it("changes several clips in one undo step", async () => {
    await kernel.bus.run(setProps, { clipIds: ["n1", "n2"], patch: { size: 20 } });
    expect(props("n2")).toEqual({ size: 20 });
    kernel.history.undo();
    expect(props("n1")).toEqual({});
    expect(props("n2")).toEqual({});
  });

  it("trims words before storing them", async () => {
    await kernel.bus.run(setProps, { clipIds: ["n1"], patch: { text: "  Yo " } });
    expect(props()).toEqual({ text: "Yo" });
  });

  it("fails with a code for each mistake", async () => {
    const run = (clipIds: string[], patch: Record<string, unknown>) =>
      failCode(kernel.bus.run(setProps, { clipIds, patch }));
    expect(await run(["nope"], {})).toBe("element.clip_not_found");
    expect(await run(["n1"], { size: 500 })).toBe("element.invalid_props");
    expect(await run(["n1"], { text: "  " })).toBe("element.invalid_props");
    expect(await run(["n1"], { volume: 1 })).toBe("element.invalid_props");
    expect(await run(["n1", "o1"], {})).toBe("element.mixed_kinds");
    expect(await run(["g1"], {})).toBe("element.unknown_kind");
    expect(await run(["n1"], { locked: 2 })).toBe("element.read_only");
  });
});

describe("element.resetProps", () => {
  it("drops the given paths", async () => {
    await kernel.bus.run(setProps, { clipIds: ["n1"], patch: { size: 20, box: { pad: 9 } } });
    await kernel.bus.run(resetProps, { clipIds: ["n1"], paths: ["box.pad"] });
    expect(props()).toEqual({ size: 20 });
  });
  it("drops everything without paths", async () => {
    await kernel.bus.run(setProps, { clipIds: ["n1"], patch: { size: 20 } });
    await kernel.bus.run(resetProps, { clipIds: ["n1"] });
    expect(props()).toEqual({});
  });
});

describe("element registry", () => {
  it("resolves a clip's values over the defaults", async () => {
    await kernel.bus.run(setProps, { clipIds: ["n1"], patch: { box: { on: true } } });
    const api = kernel.modules.require(elementRef);
    expect(api.resolve(doc().clips.n1!, doc().format)).toMatchObject({
      size: 10,
      box: { on: true, pad: 4 },
    });
  });
  it("lists every field by path", () => {
    const fields = kernel.modules.require(elementRef).get("note")!.fields;
    expect([...fields.keys()]).toEqual(["text", "size", "locked", "box", "box.on", "box.pad"]);
  });
});

describe("element_describe", () => {
  it("lists elements with a JSON schema and defaults", async () => {
    const tool = kernel.mcp.get("element_describe")!;
    const result = await tool.handler(
      {},
      {
        bus: kernel.bus,
        history: kernel.history,
        require: (ref) => kernel.modules.require(ref),
      },
    );
    const first = result.content[0] as { text: string };
    const described = JSON.parse(first.text) as Array<{ kind: string; defaults: unknown }>;
    expect(described.find((e) => e.kind === "note")?.defaults).toEqual({
      text: "Hi",
      size: 10,
      locked: 1,
      box: { on: false, pad: 4 },
    });
  });
});

describe("ElementApi.warn", () => {
  it("logs the same message once", () => {
    const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const api = createElementApi(kernel.points, log);
    api.warn('element "x": something');
    api.warn('element "x": something');
    api.warn('element "x": other');
    expect(log.warn).toHaveBeenCalledTimes(2);
    api.dispose();
  });
});
