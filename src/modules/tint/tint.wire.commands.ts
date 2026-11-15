import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import {
  gradeInputs,
  gradeKeys,
  gradeNodeSchema,
  gradeReads,
  nodeRefSchema,
  projectRef,
  type GradeNode,
} from "@/modules/project";
import { sameRef } from "./logic/order";
import { emptyGrade } from "./logic/stack";
import { checkedGrade, readGrade, writeGrade } from "./tint.guards";
import { targetSchema } from "./tint.node.commands";

/** What `createId` makes ids of (`node_k3j9x2`), so an id never breaks a `grade.nodes.<id>.` track path. */
const NODE_ID = /^[A-Za-z0-9_]+$/;

const nodeId = z.string().min(1).describe("A node id, from tint_get_grade.");

/** Which `set` field each kind of node reads its wires through. */
const WIRE_FIELDS: Record<GradeNode["kind"], readonly string[]> = {
  correct: ["input"],
  split: ["input"],
  parallel: ["inputs"],
  layer: ["inputs"],
  join: ["r", "g", "b"],
  keyJoin: ["keys"],
};

const keyEntry = z.object({
  from: nodeId.describe("A correction (its pick, as it mixes by it) or a key join."),
  mode: z.enum(["add", "subtract", "intersect"]),
});

const wireSchema = z.object({
  nodeId: z.string().min(1).describe('A node id, or "out" (the grade\'s result; input only).'),
  input: nodeRefSchema.optional(),
  inputs: z.array(nodeRefSchema).optional(),
  r: nodeRefSchema.optional(),
  g: nodeRefSchema.optional(),
  b: nodeRefSchema.optional(),
  keys: z.array(keyEntry).optional(),
});

/** Leader Seal's free wiring: sets what nodes read and adds nodes, in one step. */
export const wire = defineCommand({
  id: "tint.wire",
  label: "Wire nodes",
  description:
    'Leader Seal\'s free wiring, in one undo step: add puts new nodes in the grade first (each { id, node }, id your own: letters, digits and _ only, not taken, not "source" or "out"; node any grade node as tint_get_grade shows them: a correction, a parallel or layer join, a split, a channel join, or a key join { kind: "keyJoin", keys: [{ from, mode }] }), then set rewires nodes: input (a correction or split, or nodeId "out" for the grade\'s result), inputs (a Side by side or Stacked join; a Stacked join\'s blends stay with their refs, new refs normal; never a key join, which has no picture), r, g, b (a channel join) and keys (a key join). Refs are { node, channel? }: "source", a node id, a split\'s r, g or b. A key join combines keys: the first as it is, then each next one x by its mode: add k + x − k·x, subtract k·(1 − x), intersect k·x; a correction takes the joined key with limit.from (tint_set_correction). Any shape is allowed: what Baby Seal can\'t show becomes a sealed card covering only that region. Fails with tint.target_not_found, tint.not_gradeable, tint.node_not_found (a nodeId or ref names no node), tint.bad_id (an added id with other characters), tint.node_exists (an added id is taken), tint.cant_wire (a field that kind of node doesn\'t have), tint.wire_cycle (a node would read itself, through pictures or keys) or tint.invalid_grade (any other rule of a grade; nothing is written).',
  undoable: true,
  input: z.object({
    target: targetSchema,
    set: z.array(wireSchema),
    add: z.array(z.object({ id: z.string().min(1), node: gradeNodeSchema })).optional(),
  }),
  run(ctx, { target, set, add }) {
    const { store } = ctx.require(projectRef);
    const before = readGrade(store.getState(), target);
    const next = structuredClone(before ?? emptyGrade());
    const touched = new Set<string>();
    for (const { id, node } of add ?? []) {
      if (!NODE_ID.test(id) || id === "__proto__") {
        throw new CommandFailure(
          "tint.bad_id",
          `Node id "${id}" must be letters, digits and _ only (like node_k3j9x2)`,
          { nodeId: id },
        );
      }
      if (id === "source" || id === "out" || Object.hasOwn(next.nodes, id)) {
        throw new CommandFailure("tint.node_exists", `Node id "${id}" is taken`, { nodeId: id });
      }
      next.nodes[id] = structuredClone(node as GradeNode);
      touched.add(id);
    }
    for (const { nodeId: id, ...fields } of set) {
      const given = Object.keys(fields).filter((field) => fields[field as keyof typeof fields]);
      if (id === "out") {
        const extra = given.filter((field) => field !== "input");
        if (extra.length > 0 || !fields.input) {
          throw new CommandFailure("tint.cant_wire", `"out" takes input only`, { nodeId: id });
        }
        next.out = fields.input;
        continue;
      }
      if (!Object.hasOwn(next.nodes, id)) {
        throw new CommandFailure("tint.node_not_found", `No node "${id}" in this grade`, {
          nodeId: id,
        });
      }
      const node = next.nodes[id]!;
      const extra = given.filter((field) => !WIRE_FIELDS[node.kind].includes(field));
      if (extra.length > 0) {
        throw new CommandFailure(
          "tint.cant_wire",
          `Node "${id}" (${node.kind}) has no ${extra.join(", ")} to wire; it takes ${WIRE_FIELDS[node.kind].join(", ")}`,
          { nodeId: id, fields: extra },
        );
      }
      if (fields.input && (node.kind === "correct" || node.kind === "split")) {
        node.input = fields.input;
      }
      if (fields.inputs && (node.kind === "parallel" || node.kind === "layer")) {
        if (node.kind === "layer") {
          // Each blend stays with its ref; a new ref is normal.
          const used = new Set<number>();
          node.blends = fields.inputs.map((ref) => {
            const i = node.inputs.findIndex((old, at) => !used.has(at) && sameRef(old, ref));
            if (i < 0) return "normal";
            used.add(i);
            return node.blends[i] ?? "normal";
          });
        }
        node.inputs = fields.inputs;
      }
      if (node.kind === "join") {
        node.r = fields.r ?? node.r;
        node.g = fields.g ?? node.g;
        node.b = fields.b ?? node.b;
      }
      if (fields.keys && node.kind === "keyJoin") node.keys = fields.keys;
      touched.add(id);
    }
    const reads = (id: string) => [
      ...gradeInputs(next.nodes[id]!).map((ref) => ref.node),
      ...gradeKeys(next.nodes[id]!),
    ];
    const missing = [next.out.node, ...[...touched].flatMap(reads)].find(
      (read) => read !== "source" && !Object.hasOwn(next.nodes, read),
    );
    if (missing !== undefined) {
      throw new CommandFailure("tint.node_not_found", `No node "${missing}" in this grade`, {
        nodeId: missing,
      });
    }
    for (const id of touched) {
      const loop = reads(id).find((read) => read !== "source" && gradeReads(next, read, id));
      if (loop !== undefined) {
        throw new CommandFailure(
          "tint.wire_cycle",
          `Node "${id}" can't read "${loop}": that one reads "${id}", so the picture or key would read itself.`,
          { nodeId: id, from: loop },
        );
      }
    }
    const stored = checkedGrade(next);
    if (JSON.stringify(stored) === JSON.stringify(before ?? undefined)) return;
    ctx.mutate(store, (draft) => writeGrade(draft, target, stored));
  },
});

/** Where nodes sit in Leader Seal: the user's layout. */
export const placeNodes = defineCommand({
  id: "tint.placeNodes",
  label: "Move nodes",
  description:
    "Sets where nodes sit in Leader Seal, in graph units (about 150 between columns, 100 between rows), by node id from tint_get_grade; nodes not given keep theirs (or are laid out automatically). One undo step; nothing is written when no place changes. Fails with tint.target_not_found, tint.not_gradeable or tint.node_not_found.",
  undoable: true,
  input: z.object({
    target: targetSchema,
    pos: z.record(nodeId, z.object({ x: z.number().finite(), y: z.number().finite() })),
  }),
  run(ctx, { target, pos }) {
    const { store } = ctx.require(projectRef);
    const before = readGrade(store.getState(), target);
    const next = structuredClone(before ?? emptyGrade());
    for (const [id, { x, y }] of Object.entries(pos)) {
      if (!Object.hasOwn(next.nodes, id)) {
        throw new CommandFailure("tint.node_not_found", `No node "${id}" in this grade`, {
          nodeId: id,
        });
      }
      next.nodes[id]!.pos = { x, y };
    }
    const stored = checkedGrade(next);
    if (JSON.stringify(stored) === JSON.stringify(before ?? undefined)) return;
    ctx.mutate(store, (draft) => writeGrade(draft, target, stored));
  },
});
