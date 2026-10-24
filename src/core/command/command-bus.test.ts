import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CommandFailure } from "../errors/result";
import { createHistory } from "../history/history";
import { createPatchableStore } from "../store/patchable-store";
import { createCommandBus } from "./command-bus";
import { defineCommand } from "./define-command";

function setup(timeoutMs?: number) {
  const history = createHistory();
  const bus = createCommandBus({ history, timeoutMs });
  const store = createPatchableStore("test", { items: [] as string[], count: 0 });
  return { history, bus, store };
}

describe("command bus", () => {
  it("validates input before running", async () => {
    const { bus } = setup();
    let ran = false;
    const cmd = defineCommand({
      id: "test.add",
      label: "Add",
      description: "",
      undoable: true,
      input: z.object({ name: z.string().min(1) }),
      run: () => {
        ran = true;
      },
    });
    const result = await bus.run(cmd, { name: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_input");
    expect(ran).toBe(false);
  });

  it("rolls back every change when a command throws", async () => {
    const { bus, store, history } = setup();
    const cmd = defineCommand({
      id: "test.fail",
      label: "Fail",
      description: "",
      undoable: true,
      input: z.object({}),
      run(ctx) {
        ctx.mutate(store, (d) => void d.items.push("a"));
        ctx.mutate(store, (d) => void (d.count = 5));
        throw new CommandFailure("test.nope", "nope");
      },
    });
    const result = await bus.run(cmd, {});
    expect(result).toEqual({ ok: false, error: { code: "test.nope", message: "nope" } });
    expect(store.getState()).toEqual({ items: [], count: 0 });
    expect(history.getSnapshot().canUndo).toBe(false);
  });

  it("reports unexpected errors as internal without throwing", async () => {
    const { bus } = setup();
    const cmd = defineCommand({
      id: "test.crash",
      label: "Crash",
      description: "",
      undoable: false,
      input: z.object({}),
      run() {
        throw new TypeError("boom");
      },
    });
    const result = await bus.run(cmd, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toEqual({ code: "internal", message: "boom" });
  });

  it("records one undoable step per top-level command, tagged with its origin", async () => {
    const { bus, store, history } = setup();
    const inner = defineCommand({
      id: "test.inner",
      label: "Inner",
      description: "",
      undoable: true,
      input: z.object({ v: z.string() }),
      run: (ctx, { v }) => ctx.mutate(store, (d) => void d.items.push(v)),
    });
    const outer = defineCommand({
      id: "test.outer",
      label: "Outer",
      description: "",
      undoable: true,
      input: z.object({}),
      async run(ctx) {
        await ctx.execute(inner, { v: "a" });
        await ctx.execute(inner, { v: "b" });
      },
    });
    await bus.run(outer, {}, { origin: "agent" });
    expect(store.getState().items).toEqual(["a", "b"]);

    const snapshot = history.getSnapshot();
    expect(snapshot.past).toHaveLength(1);
    expect(snapshot.past[0]).toMatchObject({ commandId: "test.outer", origin: "agent" });

    history.undo();
    expect(store.getState().items).toEqual([]);
    history.redo();
    expect(store.getState().items).toEqual(["a", "b"]);
  });

  it("runs commands one at a time in call order", async () => {
    const { bus, store } = setup();
    const slowAppend = defineCommand({
      id: "test.append",
      label: "Append",
      description: "",
      undoable: true,
      input: z.object({ v: z.string(), delay: z.number() }),
      async run(ctx, { v, delay }) {
        await new Promise((r) => setTimeout(r, delay));
        ctx.mutate(store, (d) => void d.items.push(v));
      },
    });
    await Promise.all([
      bus.run(slowAppend, { v: "first", delay: 20 }),
      bus.run(slowAppend, { v: "second", delay: 0 }),
    ]);
    expect(store.getState().items).toEqual(["first", "second"]);
  });

  it("times out a hung command and keeps the queue moving", async () => {
    const { bus, store } = setup(20);
    const hang = defineCommand({
      id: "test.hang",
      label: "Hang",
      description: "",
      undoable: true,
      input: z.object({}),
      run: () => new Promise<void>(() => {}),
    });
    const bump = defineCommand({
      id: "test.bump",
      label: "Bump",
      description: "",
      undoable: true,
      input: z.object({}),
      run: (ctx) => ctx.mutate(store, (d) => void d.count++),
    });
    const [hung, bumped] = await Promise.all([bus.run(hang, {}), bus.run(bump, {})]);
    expect(hung.ok).toBe(false);
    if (!hung.ok) expect(hung.error.code).toBe("timeout");
    expect(bumped.ok).toBe(true);
    expect(store.getState().count).toBe(1);
  });

  it("executes registered commands by id and rejects unknown ids", async () => {
    const { bus, store } = setup();
    bus.register(
      defineCommand({
        id: "test.bump",
        label: "Bump",
        description: "",
        undoable: true,
        input: z.object({}),
        run: (ctx) => ctx.mutate(store, (d) => void d.count++),
      }),
    );
    expect((await bus.execute("test.bump", {})).ok).toBe(true);
    const unknown = await bus.execute("test.missing", {});
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe("unknown_command");
  });
});
