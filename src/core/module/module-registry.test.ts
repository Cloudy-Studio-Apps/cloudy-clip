import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createCommandBus } from "../command/command-bus";
import { defineCommand } from "../command/define-command";
import { createHistory } from "../history/history";
import { createMcpRegistry } from "../mcp/mcp-registry";
import { defineModule, defineModuleRef } from "./define-module";
import { createModuleRegistry } from "./module-registry";
import { createPointRegistry, definePoint } from "./points";

function setup() {
  const history = createHistory();
  const bus = createCommandBus({ history });
  const mcp = createMcpRegistry();
  const points = createPointRegistry();
  const modules = createModuleRegistry({ bus, history, mcp, points });
  return { bus, points, modules };
}

const panels = definePoint<string>("panels");

function command(id: string) {
  return defineCommand({
    id,
    label: id,
    description: id,
    undoable: false,
    input: z.object({}),
    run: () => undefined,
  });
}

describe("module registry", () => {
  it("setup api is returned by require", async () => {
    const { modules } = setup();
    const ref = defineModuleRef<{ value: number }>("answer");
    await modules.load(
      defineModule({ ref, name: "Answer", setup: () => ({ api: { value: 42 } }) }),
    );
    expect(modules.require(ref).value).toBe(42);
  });

  it("ctx.require allows core modules, requires and uses, and itself", async () => {
    const { modules } = setup();
    const coreRef = defineModuleRef<string>("core-thing");
    const listedRef = defineModuleRef<string>("listed");
    const selfRef = defineModuleRef<string>("self");
    const seen: string[] = [];
    const statuses = await modules.loadAll([
      defineModule({ ref: coreRef, name: "C", tier: "core", setup: () => ({ api: "core" }) }),
      defineModule({
        ref: listedRef,
        name: "L",
        tier: "feature",
        setup: () => ({ api: "listed" }),
      }),
      defineModule({
        ref: selfRef,
        name: "S",
        tier: "feature",
        uses: ["listed"],
        setup(ctx) {
          seen.push(ctx.require(coreRef), ctx.require(listedRef));
          return { api: "self" };
        },
      }),
    ]);
    expect(statuses).toEqual({ "core-thing": "active", listed: "active", self: "active" });
    expect(seen).toEqual(["core", "listed"]);
  });

  it("ctx.require rejects an undeclared feature", async () => {
    const { modules } = setup();
    const otherRef = defineModuleRef<string>("other");
    let message = "";
    await modules.load(defineModule({ ref: otherRef, name: "O", tier: "feature" }));
    const status = await modules.load(
      defineModule({
        ref: defineModuleRef("greedy"),
        name: "G",
        tier: "feature",
        setup(ctx) {
          try {
            ctx.require(otherRef);
          } catch (error) {
            message = String(error);
            throw error;
          }
          return {};
        },
      }),
    );
    expect(status).toBe("failed");
    expect(message).toMatch(/greedy.*other/);
  });

  it("a failing setup removes its commands, tools and contributions", async () => {
    const { modules, points, bus } = setup();
    const status = await modules.load(
      defineModule({
        ref: defineModuleRef("broken"),
        name: "Broken",
        commands: [command("broken.do")],
        setup(ctx) {
          ctx.contribute(panels, "broken-panel");
          throw new Error("boom");
        },
      }),
    );
    expect(status).toBe("failed");
    expect(points.get(panels)).toEqual([]);
    expect(bus.get("broken.do")).toBeUndefined();
  });

  it("modules requiring a failed module are skipped", async () => {
    const { modules } = setup();
    let ran = false;
    const statuses = await modules.loadAll([
      defineModule({
        ref: defineModuleRef("a"),
        name: "A",
        setup: () => {
          throw new Error("boom");
        },
      }),
      defineModule({
        ref: defineModuleRef("b"),
        name: "B",
        requires: ["a"],
        setup: () => {
          ran = true;
          return {};
        },
      }),
    ]);
    expect(statuses).toEqual({ a: "failed", b: "skipped" });
    expect(ran).toBe(false);
  });

  it("commands must be namespaced by the module id", async () => {
    const { modules } = setup();
    const status = await modules.load(
      defineModule({ ref: defineModuleRef("ns"), name: "NS", commands: [command("other.do")] }),
    );
    expect(status).toBe("failed");
  });

  it("unloadAll disposes newest first and removes contributions", async () => {
    const { modules, points } = setup();
    const order: string[] = [];
    for (const id of ["first", "second"]) {
      await modules.load(
        defineModule({
          ref: defineModuleRef(id),
          name: id,
          setup(ctx) {
            ctx.contribute(panels, id);
            return { dispose: () => order.push(id) };
          },
        }),
      );
    }
    modules.unloadAll();
    expect(order).toEqual(["second", "first"]);
    expect(points.get(panels)).toEqual([]);
  });

  it("loadAll reports every status", async () => {
    const { modules } = setup();
    const statuses = await modules.loadAll([
      defineModule({ ref: defineModuleRef("a"), name: "A" }),
      defineModule({
        ref: defineModuleRef("b"),
        name: "B",
        setup: () => {
          throw new Error("boom");
        },
      }),
      defineModule({ ref: defineModuleRef("c"), name: "C", requires: ["b"] }),
    ]);
    expect(statuses).toEqual({ a: "active", b: "failed", c: "skipped" });
  });

  it("a uses dependency listed later still loads both", async () => {
    const { modules } = setup();
    const statuses = await modules.loadAll([
      defineModule({ ref: defineModuleRef("a"), name: "A", uses: ["b"] }),
      defineModule({ ref: defineModuleRef("b"), name: "B" }),
    ]);
    expect(statuses).toEqual({ a: "active", b: "active" });
  });

  it("onDispose cleanups run when setup throws later", async () => {
    const { modules } = setup();
    const cleaned: string[] = [];
    const status = await modules.load(
      defineModule({
        ref: defineModuleRef("leaky"),
        name: "Leaky",
        setup(ctx) {
          ctx.onDispose(() => cleaned.push("listener"));
          throw new Error("boom");
        },
      }),
    );
    expect(status).toBe("failed");
    expect(cleaned).toEqual(["listener"]);
  });

  it("onDispose cleanups run on unload", async () => {
    const { modules } = setup();
    const cleaned: string[] = [];
    await modules.load(
      defineModule({
        ref: defineModuleRef("tidy"),
        name: "Tidy",
        setup(ctx) {
          ctx.onDispose(() => cleaned.push("listener"));
          return {};
        },
      }),
    );
    modules.unloadAll();
    expect(cleaned).toEqual(["listener"]);
  });

  it("requiring a module that isn't loaded says so", async () => {
    const { modules } = setup();
    let message = "";
    await modules.load(
      defineModule({
        ref: defineModuleRef("early"),
        name: "Early",
        setup(ctx) {
          try {
            ctx.require(defineModuleRef("later"));
          } catch (error) {
            message = String(error);
          }
          return {};
        },
      }),
    );
    expect(message).toMatch(/"later" is not loaded/);
  });
});
