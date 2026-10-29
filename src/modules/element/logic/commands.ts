import { z } from "zod";
import type { CommandDefinition } from "@/core";
import type { LayoutItem, PanelCommandCheck, ResolvedElement } from "../element.types";

/**
 * Whether a command can sit in a panel: it must exist, take `clipIds` (an array, filled from the
 * selection) and at most one more field (the panel draws a control for it).
 */
export function checkPanelCommand(
  id: string,
  command: CommandDefinition | undefined,
): PanelCommandCheck {
  if (!command) {
    return {
      ok: false,
      reason: "missing",
      message: `command "${id}" is not registered (is its module loaded?)`,
    };
  }
  const input = command.input;
  if (!(input instanceof z.ZodObject) || !(input.shape.clipIds instanceof z.ZodArray)) {
    return {
      ok: false,
      reason: "no_clip_ids",
      message: `command "${id}" can't be placed in a panel: its input has no clipIds`,
    };
  }
  const others = Object.entries(input.shape as Record<string, z.ZodType>).filter(
    ([name]) => name !== "clipIds",
  );
  if (others.length > 1) {
    return {
      ok: false,
      reason: "too_many_fields",
      message: `command "${id}" has ${others.length} fields besides clipIds; a panel control needs at most 1`,
    };
  }
  const [field] = others;
  return field ? { ok: true, field: { name: field[0], schema: field[1] } } : { ok: true };
}

/** The command ids placed in an element's panel (its layout and its groups' sections), once each. */
export function layoutCommands(element: ResolvedElement): string[] {
  const ids = new Set<string>();
  const walk = (item: LayoutItem) => {
    if (typeof item === "string" || "path" in item || "group" in item) return;
    if ("command" in item) ids.add(item.command);
    else if ("row" in item) item.row.forEach(walk);
    else item.items.forEach(walk);
  };
  for (const section of element.definition.layout ?? []) section.items.forEach(walk);
  for (const group of element.groups) group.layout?.items.forEach(walk);
  return [...ids];
}
