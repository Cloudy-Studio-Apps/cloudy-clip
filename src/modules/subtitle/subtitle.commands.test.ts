import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { elementModule, elementRef, setProps } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { inspectorModule } from "@/modules/inspector";
import { junctionModule } from "@/modules/junction";
import { compositionModule } from "@/modules/composition";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import {
  createProjectModule,
  formatOf,
  projectRef,
  seedProject,
  stylesOf,
  type Clip,
  type SubtitleStyle,
} from "@/modules/project";
import { textModule } from "@/modules/text";
import { timelineModule } from "@/modules/timeline";
import { transformModule } from "@/modules/transform";
import { ownPaths } from "./logic/overrides";
import { toSrt } from "./logic/srt";
import { addCue, mergeCues, splitCue } from "./subtitle.cue.commands";
import { importSubtitles } from "./subtitle.import.command";
import { mark, resetToStyle, unmark } from "./subtitle.mark.commands";
import { subtitleModule } from "./subtitle.module";
import { addStyle, removeStyle, updateStyle } from "./subtitle.style.commands";

const S = 1_000_000;

let kernel: Kernel;
const doc = () => kernel.modules.require(projectRef).store.getState();
const values = (id: string) => {
  const clip = doc().clips[id]!;
  return kernel.modules.require(elementRef).resolve(clip, formatOf(doc(), clip));
};
const styleOf = (id: string): SubtitleStyle =>
  doc().subtitleStyles![doc().clips[id]!.subtitle!.styleId]!;

type Result = Promise<{ ok: true; value: unknown } | { ok: false; error: { code: string } }>;
async function ok<T>(promise: Result) {
  const result = await promise;
  if (!result.ok) throw new Error(`command failed: ${result.error.code}`);
  return result.value as T;
}
async function code(promise: Result) {
  const result = await promise;
  if (result.ok) throw new Error("expected a failure");
  return result.error.code;
}

const textClip = (id: string, start: number, props: Record<string, unknown> = {}): Clip => ({
  id,
  trackId: "v1",
  kind: "text",
  start,
  sourceIn: 0,
  duration: S,
  props: { text: `Words ${id}`, ...props },
});

beforeEach(async () => {
  kernel = await createKernel();
  const state = seedProject();
  state.clips.a = textClip("a", 0, { size: 50, fill: { color: "#ff0000" } });
  state.clips.b = {
    ...textClip("b", S),
    masks: {
      m: {
        id: "m",
        name: "Mask 1",
        color: "orange",
        mode: "add",
        opacity: 1,
        feather: 0,
        expansion: 0,
        x: 0,
        y: 0,
        rotation: 0,
        shape: { kind: "ellipse", width: 100, height: 100 },
      },
    },
    maskOrder: ["m"],
    animation: {
      size: { blend: "number", keys: [{ id: "k1", t: 0, value: 30 }] },
    },
  };
  state.clips.c = textClip("c", 2 * S);
  state.clips.p = { ...textClip("p", 3 * S), kind: "test.picture" };
  state.tracks.v1!.clipIds.push("a", "b", "c", "p");
  await kernel.modules.loadAll([
    createProjectModule(state),
    elementModule,
    junctionModule,
    createFakeMediaModule({}),
    createFakeFontsModule({
      families: [
        {
          family: "Narrow",
          source: "google",
          variants: [
            { weight: "400", style: "normal" },
            { weight: "700", style: "normal" },
          ],
        },
      ],
    }),
    previewModule,
    timelineModule,
    compositionModule,
    inspectorModule,
    transformModule,
    textModule,
    subtitleModule,
  ]);
});

const addPunchy = () =>
  ok<{ styleId: string }>(kernel.bus.run(addStyle, { compositionId: "c1", preset: "punchy" })).then(
    (r) => r.styleId,
  );

describe("marks", () => {
  it("mark writes the style over the look and keeps words, keys and masks", async () => {
    await ok(kernel.bus.run(mark, { clipIds: ["a", "b"] }));
    const style = styleOf("a");
    expect(ownPaths(values("a"), style)).toEqual([]);
    expect(doc().clips.a!.props.text).toBe("Words a");
    const b = doc().clips.b!;
    expect(b.props.text).toBe("Words b");
    expect(b.maskOrder).toEqual(["m"]);
    expect(b.animation?.size).toBeDefined();
    // The keyed size keeps its keys and its own value.
    expect(ownPaths(values("b"), style)).toEqual(["size"]);
    expect(values("a").transform).toMatchObject(style.position);
    kernel.history.undo();
    expect(doc().clips.a!.props).toEqual({ text: "Words a", size: 50, fill: { color: "#ff0000" } });
    expect(doc().subtitleStyles ?? {}).toEqual({});
  });

  it("mark refuses a clip that is not text", async () => {
    const before = doc();
    expect(await code(kernel.bus.run(mark, { clipIds: ["a", "p"] }))).toBe("subtitle.not_text");
    expect(doc()).toBe(before);
  });

  it("marking a marked cue with another style keeps its own values", async () => {
    await ok(kernel.bus.run(mark, { clipIds: ["c"] }));
    await ok(kernel.bus.run(setProps, { clipIds: ["c"], patch: { fill: { color: "#00ff00" } } }));
    const punchy = await addPunchy();
    await ok(kernel.bus.run(mark, { clipIds: ["c"], styleId: punchy }));
    expect(doc().clips.c!.subtitle).toEqual({ styleId: punchy });
    expect(ownPaths(values("c"), styleOf("c"))).toEqual(["fill.color"]);
    expect((values("c").fill as { color: string }).color).toBe("#00ff00");
  });

  it("the first mark creates Default", async () => {
    await ok(kernel.bus.run(mark, { clipIds: ["c"] }));
    const styles = stylesOf(doc(), "c1");
    expect(styles.map((s) => [s.name, s.color])).toEqual([["Default", "blue"]]);
    expect(doc().clips.c!.subtitle).toEqual({ styleId: styles[0]!.id });
  });

  it("addStyle fromClipId copies the cue's look", async () => {
    const { styleId } = await ok<{ styleId: string }>(
      kernel.bus.run(addStyle, { fromClipId: "a" }),
    );
    const style = doc().subtitleStyles![styleId]!;
    expect(style.compositionId).toBe("c1");
    expect(style.props.size).toBe(50);
    expect(ownPaths(values("a"), style)).toEqual([]);
    expect(stylesOf(doc(), "c1").map((s) => s.name)[0]).toBe("Default");
  });

  it("unmark keeps the look", async () => {
    await ok(kernel.bus.run(mark, { clipIds: ["a"] }));
    const { subtitle, ...look } = doc().clips.a!;
    expect(subtitle).toBeDefined();
    await ok(kernel.bus.run(unmark, { clipIds: ["a"] }));
    expect(doc().clips.a).toEqual(look);
    expect(await code(kernel.bus.run(unmark, { clipIds: ["a"] }))).toBe("subtitle.not_marked");
  });

  it("resetToStyle writes the style's values (all, or the given paths)", async () => {
    await ok(kernel.bus.run(mark, { clipIds: ["a"] }));
    await ok(
      kernel.bus.run(setProps, {
        clipIds: ["a"],
        patch: { size: 77, fill: { color: "#00ff00" }, transform: { x: 40 } },
      }),
    );
    await ok(kernel.bus.run(resetToStyle, { clipIds: ["a"], paths: ["size"] }));
    expect(ownPaths(values("a"), styleOf("a"))).toEqual(["fill.color", "transform.x"]);
    await ok(kernel.bus.run(resetToStyle, { clipIds: ["a"] }));
    expect(ownPaths(values("a"), styleOf("a"))).toEqual([]);
  });
});

describe("styles", () => {
  it("updateStyle rewrites only the cues that followed", async () => {
    await ok(kernel.bus.run(mark, { clipIds: ["a", "c"] }));
    await ok(kernel.bus.run(setProps, { clipIds: ["c"], patch: { fill: { color: "#00ff00" } } }));
    const before = doc();
    const styleId = styleOf("a").id;
    const result = await ok<{ restyled: string[] }>(
      kernel.bus.run(updateStyle, { styleId, props: { size: 99, fill: { color: "#0000ff" } } }),
    );
    expect(result.restyled.sort()).toEqual(["a", "c"]);
    expect(values("a")).toMatchObject({ size: 99, fill: { color: "#0000ff" } });
    expect(values("c")).toMatchObject({ size: 99, fill: { color: "#00ff00" } });
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });

  it("updateStyle leaves keyed fields alone", async () => {
    await ok(kernel.bus.run(mark, { clipIds: ["b"] }));
    const style = styleOf("b");
    // Its size is keyed, so even a value equal to the style's stays its own.
    await ok(kernel.bus.run(updateStyle, { styleId: style.id, props: { size: 120 } }));
    expect(doc().clips.b!.animation!.size!.keys).toHaveLength(1);
    expect(values("b").size).not.toBe(120);
  });

  it("updateStyle stores what a cue would store", async () => {
    await ok(kernel.bus.run(mark, { clipIds: ["a", "c"] }));
    const styleId = styleOf("a").id;
    await ok(
      kernel.bus.run(updateStyle, {
        styleId,
        props: { font: { family: "Narrow", source: "google" }, weight: "900" },
      }),
    );
    const style = doc().subtitleStyles![styleId]!;
    expect(style.props.weight).toBe("700");
    expect(ownPaths(values("a"), style)).toEqual([]);
    expect(ownPaths(values("c"), style)).toEqual([]);
  });

  it("removeStyle moves its cues to the default style", async () => {
    await ok(kernel.bus.run(mark, { clipIds: ["a"] }));
    const punchy = await addPunchy();
    await ok(kernel.bus.run(mark, { clipIds: ["a", "c"], styleId: punchy }));
    await ok(kernel.bus.run(setProps, { clipIds: ["c"], patch: { fill: { color: "#00ff00" } } }));
    const result = await ok<{ moved: string[] }>(kernel.bus.run(removeStyle, { styleId: punchy }));
    expect(result.moved.sort()).toEqual(["a", "c"]);
    const fallback = stylesOf(doc(), "c1")[0]!;
    expect(doc().clips.a!.subtitle).toEqual({ styleId: fallback.id });
    expect(ownPaths(values("a"), fallback)).toEqual([]);
    expect(ownPaths(values("c"), fallback)).toEqual(["fill.color"]);
    expect(doc().subtitleStyles![punchy]).toBeUndefined();
  });

  it("removing the last style fails", async () => {
    await ok(kernel.bus.run(mark, { clipIds: ["a"] }));
    const before = doc();
    expect(await code(kernel.bus.run(removeStyle, { styleId: styleOf("a").id }))).toBe(
      "subtitle.last_style",
    );
    expect(doc()).toBe(before);
  });
});

describe("cues", () => {
  const cue = (start: number, text: string, duration = S) =>
    ok<{ clipId: string }>(kernel.bus.run(addCue, { start, duration, text })).then((r) => r.clipId);

  it("addCue goes on the cue track, else on a new top track", async () => {
    const first = await cue(5 * S, "One");
    const track = doc().clips[first]!.trackId;
    expect(track).not.toBe("v1");
    expect(doc().compositions.c1!.trackOrder[0]).toBe(track);
    expect(doc().tracks[track]!.name).toBe("Subtitles");
    expect(doc().clips[first]!.subtitle).toBeDefined();
    const second = await cue(7 * S, "Two");
    expect(doc().clips[second]!.trackId).toBe(track);
  });

  it("addCue refuses an overlap", async () => {
    await cue(5 * S, "One");
    const before = doc();
    expect(await code(kernel.bus.run(addCue, { start: 5.5 * S, duration: S, text: "x" }))).toBe(
      "subtitle.overlap",
    );
    expect(doc()).toBe(before);
  });

  it("splitCue cuts by the share of the words and both halves stay marked", async () => {
    const id = await cue(10 * S, "Hello brave world", 4 * S);
    const { clipIds } = await ok<{ clipIds: [string, string] }>(
      kernel.bus.run(splitCue, { clipId: id, at: 6 }),
    );
    const [left, right] = clipIds.map((c) => doc().clips[c]!) as [Clip, Clip];
    expect([left.props.text, right.props.text]).toEqual(["Hello", "brave world"]);
    expect(left.start + left.duration).toBe(right.start);
    expect(Math.abs(right.start - (10 + (4 * 6) / 17) * S)).toBeLessThanOrEqual(33_334);
    expect(left.subtitle).toBeDefined();
    expect(right.subtitle).toEqual(left.subtitle);
    expect(await code(kernel.bus.run(splitCue, { clipId: id, at: 0 }))).toBe(
      "subtitle.split_outside",
    );
  });

  it("splitCue with typed text is one undo step", async () => {
    const id = await cue(10 * S, "Hello world", 2 * S);
    const count = Object.keys(doc().clips).length;
    await ok(kernel.bus.run(splitCue, { clipId: id, at: 2, text: "Hi there" }));
    expect(Object.keys(doc().clips)).toHaveLength(count + 1);
    kernel.history.undo();
    expect(Object.keys(doc().clips)).toHaveLength(count);
    expect(doc().clips[id]!.props.text).toBe("Hello world");
    expect(doc().clips[id]!.duration).toBe(2 * S);
  });

  it("mergeCues joins adjacent cues and refuses a gap", async () => {
    const a = await cue(20 * S, "Hello");
    const b = await cue(21 * S, "world");
    const c = await cue(23 * S, "far");
    expect(await code(kernel.bus.run(mergeCues, { clipIds: [b, c] }))).toBe(
      "subtitle.not_adjacent",
    );
    await ok(kernel.bus.run(mergeCues, { clipIds: [a, b] }));
    expect(doc().clips[b]).toBeUndefined();
    expect(doc().clips[a]).toMatchObject({ start: 20 * S, duration: 2 * S });
    expect(doc().clips[a]!.props.text).toBe("Hello world");
    kernel.history.undo();
    expect(doc().clips[b]).toBeDefined();
    expect(doc().clips[a]!.duration).toBe(S);
  });
});

describe("import and export", () => {
  const SRT =
    "\uFEFF1\r\n00:00:01,000 --> 00:00:03,000\r\nHello\r\n\r\n2\r\n00:00:02,500 --> 00:00:04,000\r\nOverlap <i>x</i>\r\n\r\nbroken block\r\n\r\n3\r\n00:00:05,000 --> 00:00:06,000\r\nLast\r\n";

  it("import reads srt and vtt", async () => {
    const result = await ok<{ clipIds: string[]; trackIds: string[]; skipped: number }>(
      kernel.bus.run(importSubtitles, { text: SRT, format: "srt" }),
    );
    expect(result.clipIds).toHaveLength(3);
    expect(result.trackIds).toHaveLength(2);
    expect(result.skipped).toBe(1);
    expect(result.clipIds.every((id) => doc().clips[id]!.subtitle)).toBe(true);
    expect(doc().tracks[result.trackIds[1]!]!.name).toBe("Subtitles (2)");
    expect(doc().compositions.c1!.trackOrder.slice(0, 2)).toEqual(result.trackIds);
    const vtt = await ok<{ clipIds: string[] }>(
      kernel.bus.run(importSubtitles, {
        text: "WEBVTT\n\nNOTE hi\n\n00:01.500 --> 00:02.000 align:start\n<b>Hi</b>\n",
        format: "vtt",
        name: "Captions",
      }),
    );
    expect(doc().clips[vtt.clipIds[0]!]).toMatchObject({ start: 1_500_000, duration: 500_000 });
    expect(doc().clips[vtt.clipIds[0]!]!.props.text).toBe("Hi");
  });

  it("import of an empty file fails", async () => {
    const before = doc();
    expect(await code(kernel.bus.run(importSubtitles, { text: "WEBVTT\n", format: "vtt" }))).toBe(
      "subtitle.empty_file",
    );
    expect(doc()).toBe(before);
  });

  it("toSrt writes cues in order with ms times", async () => {
    await ok(kernel.bus.run(importSubtitles, { text: SRT, format: "srt" }));
    expect(toSrt(doc(), "c1")).toBe(
      "1\n00:00:01,000 --> 00:00:03,000\nHello\n\n2\n00:00:02,500 --> 00:00:04,000\nOverlap x\n\n3\n00:00:05,000 --> 00:00:06,000\nLast\n",
    );
  });
});
