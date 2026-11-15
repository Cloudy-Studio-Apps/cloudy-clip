import type { ClipGrade, Correction, GradeNodeId } from "@/modules/project";
import type { ToolId } from "../tint.types";
import { emptyGrade, toStack } from "./stack";
import { insertLayer } from "./stack.edit";
import { TOOL_FIELDS, clearTools } from "./tools";

/** The corrections that are layers of the top-level stack, top to bottom: what paste part matches by position. */
function layersOf(grade: ClipGrade | null): Correction[] {
  return toStack(grade).flatMap((item) => {
    const node = item.type === "layer" ? grade?.nodes[item.id] : undefined;
    return node?.kind === "correct" ? [node] : [];
  });
}

/** `into` with the fields the tools own taken from `from` (a field `from` lacks is cleared). A key's `from` is dropped: it names a node of the other grade. */
function take(into: Correction, from: Correction, tools: readonly ToolId[]): Correction {
  const next = structuredClone(into);
  clearTools(next, tools);
  for (const tool of tools) {
    const owned = TOOL_FIELDS[tool];
    for (const key of owned.values) {
      const value = from.values?.[key];
      if (value !== undefined) (next.values ??= {})[key] = structuredClone(value) as never;
    }
    if (owned.limit && from.limit) {
      next.limit = structuredClone(from.limit);
      delete next.limit.from;
    }
    if (owned.lut && from.lut) next.lut = structuredClone(from.lut);
  }
  return next;
}

/** The value fields of two corrections that differ, for the fields the tools own. */
function changedFields(a: Correction, b: Correction, tools: readonly ToolId[]): string[] {
  const keys = tools.flatMap((tool) => TOOL_FIELDS[tool].values);
  return keys.filter((k) => JSON.stringify(a.values?.[k]) !== JSON.stringify(b.values?.[k]));
}

/** What paste part gives: the grade, and for each existing correction the value fields it changes. */
export interface PartPaste {
  grade: ClipGrade;
  changed: Record<GradeNodeId, string[]>;
}

/**
 * `base` with the fields the tools own written from `source`: the n-th layer of the stack takes
 * them from the n-th layer of `source`. Only top-level layers count: groups and sealed cards are
 * skipped on both sides (their corrections are not matched). A layer `base` lacks is added at the
 * bottom, when the source's one has something of those tools. Throws when a layer can't be added.
 */
export function pastePart(
  base: ClipGrade | null,
  source: ClipGrade,
  tools: readonly ToolId[],
  newId: () => GradeNodeId,
): PartPaste {
  let grade = base ?? emptyGrade();
  const changed: Record<GradeNodeId, string[]> = {};
  const targets = toStack(base).flatMap((item) =>
    item.type === "layer" && base?.nodes[item.id]?.kind === "correct" ? [item.id] : [],
  );
  layersOf(source).forEach((from, i) => {
    const id = targets[i];
    if (id !== undefined) {
      const node = grade.nodes[id] as Correction;
      const next = take(node, from, tools);
      changed[id] = changedFields(node, next, tools);
      grade = { ...grade, nodes: { ...grade.nodes, [id]: next } };
      return;
    }
    const fresh: Correction = {
      kind: "correct",
      input: { node: "source" },
      on: true,
      opacity: 1,
      ...(from.name !== undefined ? { name: from.name } : {}),
    };
    const node = take(fresh, from, tools);
    if (node.values || node.limit || node.lut) grade = insertLayer(grade, {}, newId(), node);
  });
  return { grade, changed };
}
