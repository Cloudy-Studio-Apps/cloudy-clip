import { describe, expect, it } from "vitest";
import { matchKeybinding } from "./shell.points";
import type { Keybinding, KeyPress } from "./shell.types";

const binding = (id: string, key: string, mod?: boolean, shift?: boolean): Keybinding => ({
  id,
  key,
  mod,
  shift,
  resolve: () => ({ command: id, input: {} }),
});

const bindings = [
  binding("undo", "z", true),
  binding("redo", "z", true, true),
  binding("split", "s"),
];

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...extra,
});

describe("matchKeybinding", () => {
  it("matches key, mod and shift exactly", () => {
    expect(matchKeybinding(bindings, press("z", { ctrlKey: true }))?.id).toBe("undo");
    expect(matchKeybinding(bindings, press("z", { ctrlKey: true, shiftKey: true }))?.id).toBe(
      "redo",
    );
    expect(matchKeybinding(bindings, press("s", { ctrlKey: true }))).toBeUndefined();
  });

  it("treats metaKey as mod", () => {
    expect(matchKeybinding(bindings, press("z", { metaKey: true }))?.id).toBe("undo");
  });

  it("is case-insensitive on key", () => {
    expect(matchKeybinding(bindings, press("S"))?.id).toBe("split");
  });

  it("returns undefined when nothing matches", () => {
    expect(matchKeybinding(bindings, press("q"))).toBeUndefined();
  });
});
