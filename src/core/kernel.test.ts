import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineCommand } from "./command/define-command";
import { commandTool } from "./mcp/define-mcp-tool";
import { createMcpBridge } from "./mcp/mcp-bridge";
import type { McpTransport } from "./mcp/mcp.types";
import { createKernel } from "./kernel";
import { createPatchableStore } from "./store/patchable-store";

const noopTransport: McpTransport = {
  registerTools: async () => {},
  onCall: async () => () => {},
  respond: async () => {},
};

describe("kernel", () => {
  it("lets an agent edit through MCP and the user undo it", async () => {
    const kernel = await createKernel();
    const store = createPatchableStore("doc", { title: "a" });
    const rename = defineCommand({
      id: "doc.rename",
      label: "Rename",
      description: "Renames the doc.",
      undoable: true,
      input: z.object({ title: z.string() }),
      run: (ctx, { title }) => ctx.mutate(store, (d) => void (d.title = title)),
    });
    await kernel.modules.load({
      id: "doc",
      name: "Doc",
      commands: [rename],
      mcpTools: [commandTool(rename, { name: "doc_rename" })],
    });

    const bridge = createMcpBridge({ ...kernel, registry: kernel.mcp, transport: noopTransport });
    const result = await bridge.handle({ id: "1", name: "doc_rename", arguments: { title: "b" } });
    expect(result.isError).toBeUndefined();
    expect(store.getState().title).toBe("b");
    expect(kernel.history.getSnapshot().past.at(-1)?.origin).toBe("agent");

    await kernel.bus.execute("history.undo", {});
    expect(store.getState().title).toBe("a");
  });

  it("returns MCP errors instead of throwing", async () => {
    const kernel = await createKernel();
    const bridge = createMcpBridge({ ...kernel, registry: kernel.mcp, transport: noopTransport });
    const unknown = await bridge.handle({ id: "1", name: "nope", arguments: {} });
    expect(unknown.isError).toBe(true);
    const empty = await bridge.handle({ id: "2", name: "history_undo", arguments: {} });
    expect(empty.isError).toBe(true);
  });

  it("isolates a module that fails to activate", async () => {
    const kernel = await createKernel();
    const status = await kernel.modules.load({
      id: "broken",
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
      activate() {
        throw new Error("fail");
      },
    });
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
