import { describe, expect, it } from "vitest";
import { createPatchableStore } from "./store.patchable";
import type { StorePolicy } from "./store.types";

interface State {
  a: number;
  double: number;
}

const policy: StorePolicy<State> = {
  diff: () => [],
  repair: () => {},
  validate: () => null,
  settle(draft) {
    draft.double = draft.a * 2;
  },
};

describe("settle", () => {
  it("makes what it writes part of the step, undone with the step", () => {
    const store = createPatchableStore("t", { a: 1, double: 2 }, policy);
    const change = store.produce((draft) => {
      draft.a = 5;
    })!;
    expect(store.getState().double).toBe(10);
    store.apply(change.inversePatches);
    expect(store.getState()).toEqual({ a: 1, double: 2 });
  });

  it("runs after writeFields", () => {
    const store = createPatchableStore("t", { a: 1, double: 2 }, policy);
    store.writeFields([{ path: ["a"], value: 7 }]);
    expect(store.getState().double).toBe(14);
  });

  it("records no change when nothing changed", () => {
    const store = createPatchableStore("t", { a: 1, double: 2 }, policy);
    expect(store.produce(() => {})).toBeNull();
  });
});
