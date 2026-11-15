import { z } from "zod";
import type { CommandDefinition } from "../command/command.types";
import type { AppError } from "../errors/result.types";
import type { McpToolDefinition, McpToolResult } from "./mcp.types";

/** Declares an MCP tool. Identity function for type inference. */
export function defineMcpTool<I extends z.ZodObject>(
  tool: McpToolDefinition<I>,
): McpToolDefinition<I> {
  return tool;
}

/** A successful result holding `value` as compact JSON (or as-is if it is a string): agents pay for every byte. */
export function textResult(value: unknown): McpToolResult {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  return { content: [{ type: "text", text }] };
}

/** A failed result the agent can read and react to. */
export function errorResult(error: AppError): McpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(error) }], isError: true };
}

/**
 * Exposes a command as an MCP tool with the same input schema. The command runs as the caller
 * and goes into the undo history like any user edit. It counts as read-only unless the command
 * is undoable or `writes` says it changes the project some other way.
 */
export function commandTool<I extends z.ZodObject, O>(
  command: CommandDefinition<I, O>,
  options: { name: string; description?: string; writes?: boolean },
): McpToolDefinition<I> {
  return {
    name: options.name,
    description: options.description ?? command.description,
    input: command.input,
    readOnly: !(command.undoable || options.writes),
    label: command.label,
    async handler(input, { bus }) {
      const result = await bus.execute(command.id, input);
      return result.ok ? textResult(result.value ?? { ok: true }) : errorResult(result.error);
    },
  };
}

/** Converts a tool's input schema to JSON Schema for the manifest. */
export function toInputJsonSchema(schema: z.ZodObject): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  return json;
}
