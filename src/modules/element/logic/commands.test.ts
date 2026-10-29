import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineCommand } from "@/core";
import { checkPanelCommand } from "./commands";

const command = (input: z.ZodObject) =>
  defineCommand({ id: "t.x", label: "X", description: "", undoable: true, input, run: () => null });

describe("checkPanelCommand", () => {
  it("is missing when no module registered it", () => {
    expect(checkPanelCommand("x.y", undefined)).toEqual({
      ok: false,
      reason: "missing",
      message: 'command "x.y" is not registered (is its module loaded?)',
    });
  });
  it("accepts clipIds alone (a button)", () => {
    expect(checkPanelCommand("t.x", command(z.object({ clipIds: z.array(z.string()) })))).toEqual({
      ok: true,
    });
  });
  it("accepts clipIds and one field (a control)", () => {
    const check = checkPanelCommand(
      "t.x",
      command(z.object({ clipIds: z.array(z.string()), preset: z.enum(["a", "b"]) })),
    );
    expect(check).toMatchObject({ ok: true, field: { name: "preset" } });
  });
  it("refuses commands that don't act on clips", () => {
    expect(checkPanelCommand("t.x", command(z.object({ clipId: z.string() })))).toMatchObject({
      ok: false,
      reason: "no_clip_ids",
    });
  });
  it("refuses more than one field besides clipIds", () => {
    const input = z.object({ clipIds: z.array(z.string()), a: z.string(), b: z.string() });
    expect(checkPanelCommand("t.x", command(input))).toMatchObject({
      ok: false,
      reason: "too_many_fields",
    });
  });
});
