import { describe, expect, it } from "vitest";
import { stylesOf } from "./logic/subtitles";
import { createProjectStore } from "./project.store";
import { seedProject } from "./project.testing";
import type { Clip, ProjectState, SubtitleStyle } from "./project.types";

const style = (id: string, compositionId: string): SubtitleStyle => ({
  id,
  compositionId,
  name: `Style ${id}`,
  color: "blue",
  props: { fontSize: 64, fill: { kind: "color", color: "#ffffff" } },
  position: { x: 0, y: 700 },
});

const cue = (id: string, trackId: string, start: number, styleId: string): Clip => ({
  id,
  kind: "text",
  trackId,
  start,
  sourceIn: 0,
  duration: 10,
  props: { text: id },
  subtitle: { styleId },
});

/** `c1` (track v1) with style `s` and cues `a`, `b` marked with it; `c2` (track w1) with none. */
function setup() {
  const state = seedProject({
    tracks: {
      v1: { id: "v1", kind: "video", name: "V", clipIds: ["a", "b"], muted: false, hidden: false },
    },
    clips: { a: cue("a", "v1", 0, "s"), b: cue("b", "v1", 20, "s") },
  });
  state.compositions.c1!.subtitleStyleOrder = ["s"];
  state.subtitleStyles = { s: style("s", "c1") };
  state.compositions.c2 = { ...state.compositions.c1!, id: "c2", trackOrder: ["w1"] };
  delete state.compositions.c2.subtitleStyleOrder;
  state.compositionOrder.push("c2");
  state.tracks.w1 = { ...state.tracks.v1!, id: "w1", compositionId: "c2", clipIds: [] };
  const store = createProjectStore(state);
  const edit = (recipe: (draft: ProjectState) => void) => store.produce(recipe);
  return { store, edit, doc: () => store.getState() };
}

describe("settleSubtitles", () => {
  it("drops the styles of a deleted composition", () => {
    const t = setup();
    t.edit((d) => {
      d.subtitleStyles!.t = style("t", "c2");
    });
    t.edit((d) => {
      delete d.compositions.c2;
      delete d.tracks.w1;
      d.compositionOrder = ["c1"];
    });
    expect(Object.values(t.doc().subtitleStyles!).map((s) => s.compositionId)).toEqual(["c1"]);
  });

  it("copies a style into the composition a marked clip moved to", () => {
    const t = setup();
    t.edit((d) => {
      d.compositions.c2!.subtitleStyleOrder = [];
      d.subtitleStyles!.other = style("other", "c2");
    });
    t.edit((d) => {
      d.clips.a!.trackId = "w1";
      d.clips.b!.trackId = "w1";
    });
    const { clips, subtitleStyles, compositions } = t.doc();
    const copyId = clips.a!.subtitle!.styleId;
    expect(clips.b!.subtitle!.styleId).toBe(copyId);
    expect(copyId).not.toBe("s");
    expect(subtitleStyles![copyId]).toEqual({
      ...subtitleStyles!.s!,
      id: copyId,
      compositionId: "c2",
    });
    expect(compositions.c2!.subtitleStyleOrder).toEqual(["other", copyId]);
    expect(subtitleStyles!.s!.compositionId).toBe("c1");
  });

  it("drops a mark whose style is gone", () => {
    const t = setup();
    t.edit((d) => {
      delete d.subtitleStyles!.s;
    });
    const { clips } = t.doc();
    expect(clips.a!.subtitle).toBeUndefined();
    expect(clips.b!.subtitle).toBeUndefined();
    expect(clips.a!.props).toEqual({ text: "a" });
  });

  it("order lists only existing styles", () => {
    const t = setup();
    t.edit((d) => {
      d.subtitleStyles!.t = style("t", "c1");
      d.compositions.c1!.subtitleStyleOrder = ["gone", "t", "s", "t"];
      d.compositions.c2!.subtitleStyleOrder = ["s"];
    });
    expect(t.doc().compositions.c1!.subtitleStyleOrder).toEqual(["t", "s"]);
    expect(t.doc().compositions.c2!.subtitleStyleOrder).toEqual([]);
    expect(stylesOf(t.doc(), "c1").map((s) => s.id)).toEqual(["t", "s"]);
  });
});
