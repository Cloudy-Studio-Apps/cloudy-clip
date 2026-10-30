import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineCommand } from "./command/command.define";
import { LOCAL_ACTOR } from "./command/command.actor";
import { commandTool, defineMcpTool, textResult } from "./mcp/mcp.tool";
import { createMcpBridge } from "./mcp/mcp.bridge";
import type { McpTransport } from "./mcp/mcp.types";
import { createKernel } from "./kernel";
import type { Kernel } from "./kernel.types";
import { defineModule, defineModuleRef } from "./module/module.define";
import { createPatchableStore } from "./store/store.patchable";
import type { PatchableStore } from "./store/store.types";

const noopTransport: McpTransport = {
  registerTools: async () => {},
  onCall: async () => () => {},
  onConnected: async () => () => {},
  respond: async () => {},
};

function bridgeOf(kernel: Kernel) {
  return createMcpBridge({ ...kernel, registry: kernel.mcp, transport: noopTransport });
}

const docRef = defineModuleRef<{ store: PatchableStore<{ title: string }> }>("doc");

const rename = defineCommand({
  id: "doc.rename",
  label: "Rename",
  description: "Renames the doc.",
  undoable: true,
  input: z.object({ title: z.string() }),
  run: (ctx, { title }) => ctx.mutate(ctx.require(docRef).store, (d) => void (d.title = title)),
});

const docModule = defineModule({
  ref: docRef,
  name: "Doc",
  commands: [rename],
  mcpTools: [
    commandTool(rename, { name: "doc_rename" }),
    defineMcpTool({
      name: "doc_title",
      description: "Returns the title.",
      input: z.object({}),
      handler: (_input, ctx) => textResult(ctx.require(docRef).store.getState().title),
    }),
  ],
  setup: () => ({ api: { store: createPatchableStore("doc", { title: "a" }) } }),
});

describe("kernel", () => {
  it("commands reach module state through ctx.require, and agents' edits undo", async () => {
    const kernel = await createKernel();
    await kernel.modules.load(docModule);
    const store = kernel.modules.require(docRef).store;

    const result = await bridgeOf(kernel).handle({
      id: "1",
      name: "doc_rename",
      arguments: { title: "b" },
    });
    expect(result.isError).toBeUndefined();
    expect(store.getState().title).toBe("b");
    expect(kernel.history.getSnapshot().past.at(-1)?.origin).toBe("agent");

    await kernel.bus.execute("history.undo", {});
    expect(store.getState().title).toBe("a");
  });

  const claude = { key: "agent-1", name: "Claude Code" };

  it("records the calling agent on the step", async () => {
    const kernel = await createKernel();
    await kernel.modules.load(docModule);
    await bridgeOf(kernel).handle({
      id: "1",
      name: "doc_rename",
      arguments: { title: "b" },
      caller: claude,
    });
    expect(kernel.history.getSnapshot().past.at(-1)).toMatchObject({
      actor: "agent-1",
      origin: "agent",
    });
  });

  it("a hand-written tool using ctx.bus runs as its caller", async () => {
    const kernel = await createKernel();
    await kernel.modules.load(docModule);
    const unregister = kernel.mcp.register(
      defineMcpTool({
        name: "doc_rename_by_hand",
        description: "Renames.",
        input: z.object({}),
        async handler(_input, { bus }) {
          await bus.run(rename, { title: "c" });
          return textResult("done");
        },
      }),
    );
    await bridgeOf(kernel).handle({
      id: "1",
      name: "doc_rename_by_hand",
      arguments: {},
      caller: claude,
    });
    expect(kernel.history.getSnapshot().past.at(-1)).toMatchObject({
      actor: "agent-1",
      origin: "agent",
    });
    unregister();
  });

  it("an observer's deny stops the call before the tool runs", async () => {
    const kernel = await createKernel();
    await kernel.modules.load(docModule);
    kernel.mcp.observe({
      connected: () => {},
      call: () => ({ deny: { code: "x.no", message: "no" } }),
      finished: () => [],
    });
    const result = await bridgeOf(kernel).handle({
      id: "1",
      name: "doc_rename",
      arguments: { title: "b" },
    });
    expect(result.isError).toBe(true);
    expect(kernel.modules.require(docRef).store.getState().title).toBe("a");
  });

  it("appends the observer's notes to the reply and stamps its label on the step", async () => {
    const kernel = await createKernel();
    await kernel.modules.load(docModule);
    kernel.mcp.observe({
      connected: () => {},
      call: () => ({ label: "Rename the doc" }),
      finished: () => ["note"],
    });
    const result = await bridgeOf(kernel).handle({
      id: "1",
      name: "doc_rename",
      arguments: { title: "b" },
    });
    expect(result.content.at(-1)).toEqual({ type: "text", text: "note" });
    expect(kernel.history.getSnapshot().undoLabel).toBe("Rename the doc");
  });

  it("a user command defaults to the local actor", async () => {
    const kernel = await createKernel();
    await kernel.modules.load(docModule);
    await kernel.bus.run(rename, { title: "b" });
    expect(kernel.history.getSnapshot().past.at(-1)?.actor).toBe(LOCAL_ACTOR);
  });

  it("marks what writes: undoable commands and anything flagged", async () => {
    const kernel = await createKernel();
    await kernel.modules.load(docModule);
    expect(kernel.mcp.get("doc_rename")?.readOnly).toBe(false);
    expect(kernel.mcp.get("history_undo")?.readOnly).toBe(false);
    expect(kernel.mcp.get("history_list")?.readOnly).toBe(true);
  });

  it("MCP tools can require modules", async () => {
    const kernel = await createKernel();
    await kernel.modules.load(docModule);
    const result = await bridgeOf(kernel).handle({ id: "1", name: "doc_title", arguments: {} });
    expect(result.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("a") });
  });

  it("returns MCP errors instead of throwing", async () => {
    const kernel = await createKernel();
    const bridge = bridgeOf(kernel);
    const unknown = await bridge.handle({ id: "1", name: "nope", arguments: {} });
    expect(unknown.isError).toBe(true);
    const empty = await bridge.handle({ id: "2", name: "history_undo", arguments: {} });
    expect(empty.isError).toBe(true);
  });

  it("isolates a module that fails to set up", async () => {
    const kernel = await createKernel();
    const status = await kernel.modules.load(
      defineModule({
        ref: defineModuleRef("broken"),
        name: "Broken",
        commands: [
          defineCommand({
            id: "broken.do",
            label: "Do",
            description: "",
            undoable: false,
            input: z.object({}),
            run: () => {},
          }),
        ],
        setup() {
          throw new Error("fail");
        },
      }),
    );
    expect(status).toBe("failed");
    expect(kernel.bus.get("broken.do")).toBeUndefined();
  });

  it("publishes JSON schemas for MCP tools", async () => {
    const kernel = await createKernel();
    const manifest = kernel.mcp.manifest();
    expect(manifest.map((t) => t.name)).toContain("history_undo");
    expect(manifest[0]?.inputSchema).toMatchObject({ type: "object" });
  });
});
