import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { inspectorModule, inspectorSections } from "@/modules/inspector";
import { createFakeMediaModule } from "@/modules/media";
import { createFakeFontsModule } from "@/modules/fonts";
import { elementModule } from "@/modules/element";
import { previewModule, previewRef } from "@/modules/preview";
import { createEmptyProject, createProjectModule, projectRef } from "@/modules/project";
import { addClip, timelineModule } from "@/modules/timeline";
import { textRef } from "./text.ref";
import { transformModule } from "@/modules/transform";
import { clipText, isTextClip, textStyleOf } from "@/modules/project";
import { addText, applyTextPreset, setText, setTextStyle } from "./text.commands";
import { textModule } from "./text.module";

const S = 1_000_000;
let kernel: Kernel;
let statuses: Record<string, string>;
const doc = () => kernel.modules.require(projectRef).store.getState();
const videoTracks = () => doc().trackOrder.filter((id) => doc().tracks[id]!.kind === "video");

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
  it("loads, contributes its six inspector sections and has recent colors", () => {
    expect(statuses.text).toBe("active");
    expect(statuses.transform).toBe("active");
    const ids = kernel.points.get(inspectorSections).map((s) => s.id);
    for (const name of ["content", "font", "fill", "outline", "background", "shadow"]) {
      expect(ids).toContain(`text.${name}`);
    }
    expect(kernel.modules.require(textRef).recents.store.getState().colors).toBeInstanceOf(Array);
  });
});

describe("text.add", () => {
  it("adds 3 s of the default text at the playhead on the top video track", async () => {
    await run(kernel.bus.run(addClip, { mediaId: "mv" })); // the playhead stays within content
    kernel.modules.require(previewRef).playback.seek(2 * S);
    const clip = await run(kernel.bus.run(addText, {}));
    expect(clip).toMatchObject({ kind: "text", props: {}, start: 2 * S, duration: 3 * S });
    expect(clip.trackId).toBe(videoTracks()[0]);
  });

  it("opens a new top video track over a video", async () => {
    await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const clip = await run(kernel.bus.run(addText, { start: S }));
    expect(videoTracks()).toHaveLength(2);
    expect(clip.trackId).toBe(videoTracks()[0]);
  });

  it("refuses an audio track", async () => {
    const audio = doc().trackOrder.find((id) => doc().tracks[id]!.kind === "audio")!;
    const result = await kernel.bus.run(addText, { trackId: audio });
    expect(!result.ok && result.error.code).toBe("text.kind_mismatch");
  });

  it("refuses a busy named track", async () => {
    await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const result = await kernel.bus.run(addText, { start: S, trackId: videoTracks()[0] });
    expect(!result.ok && result.error.code).toBe("timeline.overlap");
  });

  it("undoes adding text, and the track it opened, in one step", async () => {
    await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const before = doc();
    await run(kernel.bus.run(addText, { start: S }));
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });
});

const textClip = async () => run(kernel.bus.run(addText, { start: 0 }));
const styleOf = (id: string) => textStyleOf(doc().clips[id]!, doc().format);

describe("text.setText", () => {
  it("changes the words", async () => {
    const clip = await textClip();
    await run(kernel.bus.run(setText, { clipId: clip.id, text: "Hello" }));
    expect(clipText(doc().clips[clip.id]!)).toBe("Hello");
  });

  it("refuses empty words, missing clips and media clips", async () => {
    const clip = await textClip();
    const empty = await kernel.bus.run(setText, { clipId: clip.id, text: "  " });
    expect(!empty.ok && empty.error.code).toBe("text.empty");
    const missing = await kernel.bus.run(setText, { clipId: "nope", text: "x" });
    expect(!missing.ok && missing.error.code).toBe("text.clip_not_found");
    const media = (await run(kernel.bus.run(addClip, { mediaId: "mv" }))).clips[0]!;
    const result = await kernel.bus.run(setText, { clipId: media.id, text: "x" });
    expect(!result.ok && result.error.code).toBe("text.not_text");
    expect(isTextClip(doc().clips[clip.id]!)).toBe(true);
  });
});

describe("text.setStyle", () => {
  it("merges a nested patch and keeps the rest", async () => {
    const clip = await textClip();
    await run(
      kernel.bus.run(setTextStyle, { clipIds: [clip.id], style: { fill: { opacity: 0.5 } } }),
    );
    expect(styleOf(clip.id)?.fill).toEqual({ color: "#ffffff", opacity: 0.5 });
  });

  it("checks the weight against a known family only", async () => {
    const clip = await textClip();
    const font = { family: "Roboto", source: "google" as const };
    const bad = await kernel.bus.run(setTextStyle, {
      clipIds: [clip.id],
      style: { font, weight: "700" },
    });
    expect(!bad.ok && bad.error.code).toBe("text.weight_unavailable");
    const unknown = await kernel.bus.run(setTextStyle, {
      clipIds: [clip.id],
      style: { font: { family: "Nonexistent Font", source: "google" }, weight: "700" },
    });
    expect(unknown.ok).toBe(true);
  });

  it("lowercases colors and rejects out of range values", async () => {
    const clip = await textClip();
    await run(
      kernel.bus.run(setTextStyle, { clipIds: [clip.id], style: { fill: { color: "#FFAA00" } } }),
    );
    expect(styleOf(clip.id)?.fill.color).toBe("#ffaa00");
    const bad = await kernel.bus.run(setTextStyle, { clipIds: [clip.id], style: { size: 0 } });
    expect(bad.ok).toBe(false);
  });

  it("changes nothing when one of the clips is bad", async () => {
    const clip = await textClip();
    const before = doc();
    const result = await kernel.bus.run(setTextStyle, {
      clipIds: [clip.id, "nope"],
      style: { size: 50 },
    });
    expect(!result.ok && result.error.code).toBe("text.clip_not_found");
    expect(doc()).toEqual(before);
  });
});

describe("text.applyPreset", () => {
  it("sets the style and the transform in one undo step", async () => {
    const clip = await textClip();
    const before = doc();
    await run(kernel.bus.run(applyTextPreset, { clipId: clip.id, preset: "lower-third" }));
    expect(styleOf(clip.id)?.align).toBe("left");
    expect(doc().clips[clip.id]?.transform).toMatchObject({ x: -216, y: 614.4 });
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });
});

describe("text.applyPreset rollback", () => {
  it("leaves the style alone when the nested transform fails", async () => {
    const clip = await textClip();
    // A frame this wide puts the lower third beyond what setClipTransform accepts.
    kernel.modules.require(projectRef).store.api.setState((s) => ({
      format: { ...s.format, width: 1_000_000 },
    }));
    const before = doc();
    const result = await kernel.bus.run(applyTextPreset, {
      clipId: clip.id,
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
    await run(kernel.bus.run(setTextStyle, { clipIds: [clip.id], style: { font: roboto } }));
    await run(kernel.bus.run(applyTextPreset, { clipId: clip.id, preset: "lower-third" }));
    expect(styleOf(clip.id)).toMatchObject({ weight: "400", italic: false });
  });

  it("text.applyPreset pop drops the italic", async () => {
    const clip = await textClip();
    await run(kernel.bus.run(setTextStyle, { clipIds: [clip.id], style: { font: roboto } }));
    await run(kernel.bus.run(applyTextPreset, { clipId: clip.id, preset: "pop" }));
    expect(styleOf(clip.id)).toMatchObject({ weight: "400", italic: false });
  });

  it("text.add with a preset and a font snaps to the family", async () => {
    const clip = await run(kernel.bus.run(addText, { preset: "pop", style: { font: roboto } }));
    expect(styleOf(clip.id)).toMatchObject({ weight: "400", italic: false });
  });

  it("text.setStyle with only a font snaps a bold clip", async () => {
    const clip = await textClip();
    await run(kernel.bus.run(setTextStyle, { clipIds: [clip.id], style: { font: roboto } }));
    expect(styleOf(clip.id)).toMatchObject({ weight: "400", italic: false });
  });

  it("text.setStyle fails on an explicit italic the family lacks", async () => {
    const clip = await textClip();
    const result = await kernel.bus.run(setTextStyle, {
      clipIds: [clip.id],
      style: { font: roboto, italic: true },
    });
    expect(!result.ok && result.error.code).toBe("text.italic_unavailable");
  });
});

describe("text.add with a look", () => {
  it("stores the preset and the words", async () => {
    const clip = await run(kernel.bus.run(addText, { preset: "outline", text: "Hi" }));
    expect(clipText(clip)).toBe("Hi");
    expect(styleOf(clip.id)?.outline.enabled).toBe(true);
  });
});
