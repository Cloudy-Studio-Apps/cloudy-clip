import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import { compositionModule } from "@/modules/composition";
import { elementModule, setProps } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { inspectorModule } from "@/modules/inspector";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import { seedProject, createProjectModule, projectRef } from "@/modules/project";
import { timelineModule } from "@/modules/timeline";
import { transformModule } from "@/modules/transform";
import { addSticker } from "./sticker.add.command";
import { createStickerElement } from "./sticker.element";
import { stickerModule } from "./sticker.module";
import { stickerPacks } from "./sticker.points";
import { stickerRef } from "./sticker.ref";
import type { StickerArtCache, StickerDefinition, StickerPackDefinition } from "./sticker.types";

const arrow: StickerDefinition = {
  id: "arrow",
  label: "Arrow",
  variations: ["color"],
  art: (v) => ({ type: "image", url: `arrow-${v.color}.svg` }),
};

const marks: StickerPackDefinition = {
  id: "marks",
  name: "Marks",
  order: 1,
  variations: [
    {
      id: "color",
      label: "Color",
      options: [
        { id: "white", label: "White" },
        { id: "red", label: "Red" },
      ],
      default: "white",
    },
  ],
  stickers: () => Promise.resolve([arrow]),
};

const broken: StickerPackDefinition = {
  id: "broken",
  name: "Broken",
  order: 2,
  stickers: () => Promise.reject(new Error("no list")),
};

const packsModule = defineModule({
  ref: defineModuleRef<Record<string, never>>("sticker-add-test-packs"),
  name: "packs",
  tier: "feature",
  requires: ["sticker"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(stickerPacks, marks, broken);
    return { api: {} };
  },
});

let kernel: Kernel;
const doc = () => kernel.modules.require(projectRef).store.getState();
const clips = () => Object.values(doc().clips);
const api = () => kernel.modules.require(stickerRef);

/** Art that says yes or no as told; the real one needs a DOM. */
function fakeArt(ready = true): StickerArtCache {
  return { ready: () => ready, draw: () => false, dispose: () => undefined };
}

function readyOf(art: StickerArtCache, pack: string, sticker: string): boolean {
  const { picture } = createStickerElement(api(), art);
  return picture!.ready!({ pack, sticker, variation: {} }, { time: 0 });
}

beforeEach(async () => {
  kernel = await createKernel();
  await kernel.modules.loadAll([
    createProjectModule(seedProject()),
    elementModule,
    junctionModule,
    createFakeMediaModule({}),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
    compositionModule,
    inspectorModule,
    transformModule,
    stickerModule,
    packsModule,
  ]);
});

describe("sticker.add", () => {
  it("adds a clip holding only references, as one undo step", async () => {
    const before = doc();
    const result = await kernel.bus.run(addSticker, {
      pack: "marks",
      sticker: "arrow",
      variation: { color: "red" },
    });
    expect(result.ok).toBe(true);
    expect(clips()).toHaveLength(1);
    expect(clips()[0]).toMatchObject({
      kind: "sticker",
      duration: 3_000_000,
      props: { pack: "marks", sticker: "arrow", variation: { color: "red" } },
    });
    kernel.history.undo();
    expect(doc().clips).toEqual(before.clips);
  });

  it("loads a pack that isn't loaded yet", async () => {
    expect(api().isLoaded("marks")).toBe(false);
    await kernel.bus.run(addSticker, { pack: "marks", sticker: "arrow" });
    expect(api().isLoaded("marks")).toBe(true);
  });

  it.each([
    ["sticker.unknown_pack", { pack: "nope", sticker: "arrow" }],
    ["sticker.unknown_sticker", { pack: "marks", sticker: "nope" }],
    ["sticker.invalid_variation", { pack: "marks", sticker: "arrow", variation: { color: "x" } }],
    ["sticker.invalid_variation", { pack: "marks", sticker: "arrow", variation: { size: "big" } }],
  ])("refuses with %s and changes nothing", async (code, input) => {
    const result = await kernel.bus.run(addSticker, input);
    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(clips()).toHaveLength(0);
  });
});

describe("sticker element", () => {
  it("rejects an invalid variation through element.setProps once the list is loaded", async () => {
    await kernel.bus.run(addSticker, { pack: "marks", sticker: "arrow" });
    const clipIds = [clips()[0]!.id];
    const result = await kernel.bus.run(setProps, {
      clipIds,
      patch: { variation: { color: "x" } },
    });
    expect(result).toMatchObject({ ok: false, error: { code: "sticker.invalid_variation" } });
  });

  it("isn't ready before the list loads, starts the load, then waits for the art", async () => {
    const waiting = fakeArt(false);
    expect(readyOf(waiting, "marks", "arrow")).toBe(false);
    await api().load("marks");
    expect(readyOf(waiting, "marks", "arrow")).toBe(false);
    expect(readyOf(fakeArt(true), "marks", "arrow")).toBe(true);
  });

  it("is ready when its pack is gone, so the preview isn't blocked", () => {
    expect(readyOf(fakeArt(false), "removed", "arrow")).toBe(true);
  });

  it("is ready when its sticker is gone from a loaded pack", async () => {
    await api().load("marks");
    expect(readyOf(fakeArt(false), "marks", "removed")).toBe(true);
  });

  it("is ready after its list failed to load, and stops asking", async () => {
    await api().load("broken");
    expect(readyOf(fakeArt(false), "broken", "any")).toBe(true);
    expect(api().hasFailed("broken")).toBe(true);
  });
});
