import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { inspectorModule } from "@/modules/inspector";
import { createFakeMediaModule } from "@/modules/media";
import { createFakeFontsModule } from "@/modules/fonts";
import { elementModule, elements, setProps } from "@/modules/element";
import { junctionModule } from "@/modules/junction";
import { previewModule } from "@/modules/preview";
import { createEmptyProject, createProjectModule, projectRef } from "@/modules/project";
import { addClip, addElement, timelineModule } from "@/modules/timeline";
import { transformModule } from "@/modules/transform";
import { clipText, isTextClip, textStyleOf } from "./logic/layout";
import { applyTextPreset } from "./text.commands";
import { textElement } from "./text.element";
import { textModule } from "./text.module";

const S = 1_000_000;
let kernel: Kernel;
let statuses: Record<string, string>;
const doc = () => kernel.modules.require(projectRef).store.getState();

async function run<T>(
  promise: Promise<{ ok: true; value: T } | { ok: false; error: { code: string } }>,
) {
  const result = await promise;
  if (!result.ok) throw new Error(`command failed: ${result.error.code}`);
  return result.value;
}

beforeEach(async () => {
  kernel = await createKernel();
  const project = createEmptyProject();
  project.media.mv = { id: "mv", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 };
  project.mediaOrder = ["mv"];
  statuses = await kernel.modules.loadAll([
    createProjectModule(project),
    elementModule,
    junctionModule,
    createFakeMediaModule({ mv: { status: "ready", duration: 10 * S, width: 1920, height: 1080 } }),
    createFakeFontsModule({
      families: [
        { family: "Roboto", source: "google", variants: [{ weight: "400", style: "normal" }] },
      ],
    }),
    inspectorModule,
    transformModule,
    previewModule,
    timelineModule,
    textModule,
  ]);
});

describe("text module wiring", () => {
  it("loads and registers the text element", () => {
    expect(statuses.text).toBe("active");
    expect(statuses.transform).toBe("active");
    expect(kernel.points.find(elements, "text")).toBeDefined();
  });
});

const textClip = async () => run(kernel.bus.run(addElement, { kind: "text", start: 0 }));
const styleOf = (id: string) => textStyleOf(doc().clips[id]!, doc().format);

const set = (clipIds: string[], patch: Record<string, unknown>) =>
  kernel.bus.run(setProps, { clipIds, patch });

describe("words through element.setProps", () => {
  it("changes the words", async () => {
    const clip = await textClip();
    await run(set([clip.id], { text: "Hello" }));
    expect(clipText(doc().clips[clip.id]!)).toBe("Hello");
  });

  it("refuses empty words, missing clips and mixed kinds", async () => {
    const clip = await textClip();
    const empty = await set([clip.id], { text: "  " });
    expect(!empty.ok && empty.error.code).toBe("element.invalid_props");
    const missing = await set(["nope"], { text: "x" });
    expect(!missing.ok && missing.error.code).toBe("element.clip_not_found");
    const media = (await run(kernel.bus.run(addClip, { mediaId: "mv" }))).clips[0]!;
    const mixed = await set([clip.id, media.id], { text: "x" });
    expect(!mixed.ok && mixed.error.code).toBe("element.mixed_kinds");
    const onMedia = await set([media.id], { text: "x" });
    expect(!onMedia.ok && onMedia.error.code).toBe("element.invalid_props");
    expect(isTextClip(doc().clips[clip.id]!)).toBe(true);
  });
});

describe("style through element.setProps", () => {
  it("merges a nested patch and keeps the rest", async () => {
    const clip = await textClip();
    await run(set([clip.id], { fill: { opacity: 0.5 } }));
    expect(styleOf(clip.id).fill).toEqual({ color: "#ffffff", opacity: 0.5 });
    expect(doc().clips[clip.id]!.props).toEqual({ fill: { opacity: 0.5 } });
  });

  it("checks the weight against a known family only", async () => {
    const clip = await textClip();
    const font = { family: "Roboto", source: "google" as const };
    const bad = await set([clip.id], { font, weight: "700" });
    expect(!bad.ok && bad.error.code).toBe("text.weight_unavailable");
    const unknown = await set([clip.id], {
      font: { family: "Nonexistent Font", source: "google" },
      weight: "700",
    });
    expect(unknown.ok).toBe(true);
  });

  it("lowercases colors and rejects out of range values", async () => {
    const clip = await textClip();
    await run(set([clip.id], { fill: { color: "#FFAA00" } }));
    expect(styleOf(clip.id).fill.color).toBe("#ffaa00");
    const bad = await set([clip.id], { size: 0 });
    expect(!bad.ok && bad.error.code).toBe("element.invalid_props");
  });

  it("changes nothing when one of the clips is bad", async () => {
    const clip = await textClip();
    const before = doc();
    const result = await set([clip.id, "nope"], { size: 50 });
    expect(!result.ok && result.error.code).toBe("element.clip_not_found");
    expect(doc()).toEqual(before);
  });
});

describe("text.applyPreset", () => {
  it("sets the style and the transform in one undo step", async () => {
    const clip = await textClip();
    const before = doc();
    await run(kernel.bus.run(applyTextPreset, { clipIds: [clip.id], preset: "lower-third" }));
    expect(styleOf(clip.id)?.align).toBe("left");
    expect(doc().clips[clip.id]?.transform).toMatchObject({ x: -216, y: 614.4 });
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });
});

describe("text.applyPreset on several clips", () => {
  it("styles every clip in one undo step, sized from the frame's short side", async () => {
    const a = await textClip();
    const b = await run(kernel.bus.run(addElement, { kind: "text", start: 5 * S }));
    await run(kernel.bus.run(applyTextPreset, { clipIds: [a.id, b.id], preset: "title" }));
    const size = Math.round(0.09 * Math.min(doc().format.width, doc().format.height));
    expect(styleOf(a.id).size).toBe(size);
    expect(styleOf(b.id).weight).toBe("900");
    kernel.history.undo();
    expect(styleOf(a.id).weight).toBe("700");
    expect(styleOf(b.id).weight).toBe("700");
  });
});

describe("text.applyPreset rollback", () => {
  it("leaves the style alone when the nested transform fails", async () => {
    const clip = await textClip();
    // A frame this wide puts the lower third beyond what the transform group accepts.
    kernel.modules.require(projectRef).store.api.setState((s) => ({
      format: { ...s.format, width: 1_000_000 },
    }));
    const before = doc();
    const result = await kernel.bus.run(applyTextPreset, {
      clipIds: [clip.id],
      preset: "lower-third",
    });
    expect(result.ok).toBe(false);
    expect(doc().clips[clip.id]).toEqual(before.clips[clip.id]);
  });
});

describe("faces the family lacks (Roboto: 400 only, no italic)", () => {
  const roboto = { family: "Roboto", source: "google" as const };

  it("text.applyPreset snaps the weight", async () => {
    const clip = await textClip();
    await run(set([clip.id], { font: roboto }));
    await run(kernel.bus.run(applyTextPreset, { clipIds: [clip.id], preset: "lower-third" }));
    expect(styleOf(clip.id)).toMatchObject({ weight: "400", italic: false });
  });

  it("text.applyPreset pop drops the italic", async () => {
    const clip = await textClip();
    await run(set([clip.id], { font: roboto }));
    await run(kernel.bus.run(applyTextPreset, { clipIds: [clip.id], preset: "pop" }));
    expect(styleOf(clip.id)).toMatchObject({ weight: "400", italic: false });
  });

  it("a font alone snaps a bold clip", async () => {
    const clip = await textClip();
    await run(set([clip.id], { font: roboto }));
    expect(styleOf(clip.id)).toMatchObject({ weight: "400", italic: false });
  });

  it("an explicit italic the family lacks fails", async () => {
    const clip = await textClip();
    const result = await set([clip.id], { font: roboto, italic: true });
    expect(!result.ok && result.error.code).toBe("text.italic_unavailable");
  });
});

describe("the Text tab's tiles", () => {
  const entry = (id: string) => textElement.create!.find((e) => e.id === id)!;

  it("add a plain text, a title and a placed lower third", async () => {
    const format = doc().format;
    const plain = await run(
      kernel.bus.run(addElement, { kind: "text", start: 0, props: entry("plain").props?.(format) }),
    );
    expect(doc().clips[plain.id]!.props).toEqual({});
    const title = await run(
      kernel.bus.run(addElement, {
        kind: "text",
        start: 4 * S,
        props: entry("title").props!(format),
      }),
    );
    expect(styleOf(title.id).weight).toBe("900");
    const lower = await run(
      kernel.bus.run(addElement, {
        kind: "text",
        start: 8 * S,
        props: entry("lower-third").props!(format),
      }),
    );
    expect(styleOf(lower.id).align).toBe("left");
    expect(doc().clips[lower.id]!.transform).toEqual({
      x: -0.2 * format.width,
      y: 0.32 * format.height,
      scale: 1,
      rotation: 0,
    });
  });
});
