# Keyframes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any value of a clip can change over time, edited in the Edit page through a Normal / Keyframes / Curves switch, with several clips at once, and available to agents.

**Architecture:** The data and the maths live in `project`, so the core engine reads them: `Clip.animation` and one pure function, `animatedClip(clip, time)`, called in `resolveFrame` and the canvas tools. A new feature module, `keyframe`, owns the commands, MCP tools and all the UI. `timeline` offers two points so it never knows about keyframes, and `element.setProps` writes keys for animated fields, so the inspector, canvas gestures and agents share one path.

**Tech Stack:** React 19, Zustand, Immer, Zod, Tailwind v4, canvas 2D for curves, Rust and FFmpeg for sound in export.

**Spec:** `docs/superpowers/specs/2026-11-02-keyframes-design.md`

**Visual reference:** `.superpowers/brainstorm/keyframes/keyframes-v4.html`, built on `docs/prototype/designs/b-mesa-de-noche.html`.

**Depends on:** Stages 1 to 6 need nothing unfinished. Stage 7 (Tasks 17 and 18) needs clip speed's Preview/export, Freeze frame and Reverse tasks merged. Composite isn't needed, but read the note in Task 3.

## File Tree

`+` is a new file, `~` is an edited file. Nothing is removed. Tests are listed only where rule 3 allows one, and Task 19 prunes them.

```
cloudy-clip/
├─ ~ CLAUDE.md                                  scope, Where to look, rules 13 and 35
├─ docs/
│  └─ ~ modules.md                              tier table, points table
├─ src-tauri/src/export/
│  └─ ~ recipe.rs                               volume and pan envelopes, tempo steps
└─ src/
   ├─ app/
   │  └─ ~ bootstrap.ts                         lists keyframeModule
   └─ modules/
      ├─ project/
      │  ├─ ~ project.types.ts                  KeyEase, Keyframe, KeyTrack, Clip.animation, animationOrigin
      │  ├─ ~ project.geometry.ts               clipTransform merges over the identity
      │  ├─ ~ index.ts
      │  ├─ ~ README.md
      │  └─ logic/
      │     ├─ + ease.ts                        presets, bezier and named curves
      │     ├─ + ease.test.ts
      │     ├─ + animate.ts                     trackValue, animatedClip
      │     ├─ + animate.test.ts
      │     ├─ + keys.ts                        write, move and remove keys
      │     ├─ + keys.test.ts
      │     ├─ + content.ts                     contentTime, timeOfContent, clampToClip
      │     ├─ + content.test.ts
      │     ├─ + ramp.ts                        Stage 7: the integral table
      │     ├─ + ramp.test.ts                   Stage 7
      │     ├─ ~ sound.ts                       Stage 6: soundOf merges over the defaults
      │     └─ ~ speed.ts                       Stage 7: sourceTimeAt, sourceSpan, rateAt read a ramp
      ├─ element/
      │  ├─ ~ element.commands.ts               setProps `at`, resetProps removes tracks
      │  ├─ + element.commands.test.ts
      │  ├─ ~ element.guards.ts                 element.animated
      │  ├─ ~ element.types.ts                  PropUi.keyframes, KeyableField
      │  ├─ ~ element.mcp.ts                    element_describe lists what can be keyed
      │  ├─ ~ index.ts
      │  ├─ ~ README.md
      │  └─ logic/
      │     ├─ + animated.ts                    splitAnimated
      │     └─ + keyable.ts                     keyableFields
      ├─ preview/
      │  ├─ logic/~ frame.ts                    animatedClip at the local time
      │  ├─ logic/~ drift.ts                    Stage 7: the drift limit at the current rate
      │  ├─ engine/~ engine.html.ts             Stage 7: playbackRate follows the ramp
      │  ├─ engine/~ engine.sync.ts             Stage 7
      │  └─ ~ README.md
      ├─ timeline/
      │  ├─ ~ timeline.points.ts                timelineTools, timelineDocks
      │  ├─ ~ timeline.types.ts                 their items, TimelineApi additions, ClipActions.badge
      │  ├─ ~ timeline.store.ts                 headerWidth, tracksHidden, scroll and zoom API
      │  ├─ ~ timeline.layout.ts                HEADER_WIDTH is the default
      │  ├─ ~ timeline.split.commands.ts        right half keeps animation
      │  ├─ ~ timeline.commands.test.ts         keys through trim and split
      │  ├─ ~ index.ts
      │  ├─ ~ README.md
      │  ├─ logic/~ placement.ts                left trim moves the origin
      │  └─ ui/
      │     ├─ + header.width.hook.ts           useHeaderWidth
      │     ├─ ~ TimelinePanel.tsx              docks, tracks hidden, header from the view
      │     ├─ ~ TimelineToolbar.tsx            reads timelineTools
      │     ├─ ~ TimelineClip.tsx               reads ClipActions.badge
      │     ├─ ~ Ruler.tsx                      header from the view
      │     ├─ ~ Playhead.tsx                   header from the view
      │     ├─ ~ TrackHeader.tsx                header from the view
      │     └─ ~ TrackInsert.tsx                header from the view
      ├─ composition/
      │  ├─ ~ composition.settings.commands.ts  key values rescale with the frame
      │  ├─ ~ composition.group.command.ts      trimToSpan moves the origin
      │  ├─ ~ README.md
      │  └─ ui/~ EndMarker.tsx                  header from the view
      ├─ collab/ui/
      │  └─ ~ AgentPlayheads.tsx                header from the view
      ├─ workspace/
      │  ├─ logic/~ format.ts                   version 3
      │  ├─ logic/~ format.test.ts              animation survives a round trip
      │  └─ ~ README.md
      ├─ inspector/
      │  ├─ ~ inspector.types.ts                FieldActionProps.clip
      │  ├─ ~ index.ts                          exports what KeyAction needs
      │  ├─ ~ README.md
      │  └─ ui/
      │     ├─ + clip.values.hook.ts            useClipAtPlayhead
      │     ├─ ~ ClipSection.tsx                values at the playhead
      │     ├─ ~ FieldItem.tsx                  passes clip to FieldActions
      │     ├─ ~ PropertySection.tsx            passes clip to FieldActions
      │     └─ ~ props.live.hook.ts             commits with `at`
      ├─ transform/
      │  ├─ ~ transform.commands.ts             reset removes tracks
      │  ├─ ~ README.md
      │  ├─ logic/~ layers.ts                   animatedClip at the time
      │  └─ ui/~ transform.gesture.ts           commits with `at`
      ├─ text/
      │  ├─ ui/~ TextEditor.tsx                 the box at the playhead's values
      │  └─ ~ README.md
      ├─ audio/
      │  ├─ + audio.keys.ts                     Stage 6: volume and pan
      │  ├─ ~ audio.commands.ts                 Stage 6: reset removes tracks
      │  ├─ ~ audio.module.ts                   Stage 6: requires keyframe
      │  ├─ ~ README.md
      │  └─ ui/~ SoundRow.tsx                   Stage 6: the diamond
      ├─ speed/
      │  ├─ + speed.keys.ts                     Stage 7: speed.rate, afterWrite
      │  ├─ ~ speed.commands.ts                 Stage 7: reset removes the ramp, hold bakes values
      │  ├─ ~ speed.commands.test.ts            Stage 7
      │  ├─ ~ speed.module.ts                   Stage 7: requires keyframe
      │  └─ ~ README.md
      ├─ export/
      │  ├─ ~ export.types.ts                   SoundSegment envelopes and tempo steps
      │  ├─ ~ README.md
      │  └─ logic/
      │     ├─ + envelope.ts                    samples a track into at most 256 points
      │     ├─ ~ mixdown.ts                     envelopes, tempo steps
      │     └─ ~ mixdown.test.ts
      └─ keyframe/                              + the whole module
         ├─ + index.ts
         ├─ + keyframe.ref.ts
         ├─ + keyframe.module.ts
         ├─ + keyframe.types.ts
         ├─ + keyframe.points.ts                keyTargets
         ├─ + keyframe.fields.ts                the built-in target, from element
         ├─ + keyframe.commands.ts              lists the three below
         ├─ + keyframe.edit.commands.ts         set, remove, move, setValues, clear
         ├─ + keyframe.ease.commands.ts         setEase, setAfter, scale
         ├─ + keyframe.clipboard.commands.ts    copy, paste
         ├─ + keyframe.view.commands.ts         toggleMode, no tool
         ├─ + keyframe.commands.test.ts
         ├─ + keyframe.guards.ts                requireKey, requireField, checkKeyValue
         ├─ + keyframe.mcp.ts
         ├─ + keyframe.view.store.ts
         ├─ + keyframe.layout.ts
         ├─ + README.md
         ├─ logic/
         │  ├─ + range.ts                       keys shown in a time window
         │  ├─ + moves.ts                       a group's clamped move
         │  ├─ + graph.ts                       value and time to pixels
         │  ├─ + handles.ts                     bezier to handles, smooth alignment
         │  ├─ + picking.ts                     hit tests, box select
         │  ├─ + snap.ts                        frames, playhead, edges, keys
         │  └─ + motion.ts                      position path samples
         └─ ui/
            ├─ + index.ts
            ├─ + ModeSwitch.tsx
            ├─ + KeyPanel.tsx
            ├─ + PanelToolbar.tsx
            ├─ + PanelPlayhead.tsx
            ├─ + ClipGroup.tsx
            ├─ + PropertyRow.tsx
            ├─ + KeyBand.tsx
            ├─ + KeyDiamond.tsx
            ├─ + CurveGraph.tsx
            ├─ + curve.draw.ts
            ├─ + PresetStrip.tsx
            ├─ + EaseThumb.tsx
            ├─ + KeyAction.tsx                  the inspector's field action
            ├─ + MotionPath.tsx
            ├─ + key.gesture.ts
            ├─ + box.gesture.ts
            ├─ + curve.gesture.ts
            ├─ + handle.gesture.ts
            ├─ + motion.gesture.ts
            ├─ + panel.scroll.hook.ts
            ├─ + panel.rows.hook.ts
            └─ + panel.keys.hook.ts             Delete and the clipboard while keys are selected
```

## Global Constraints

- Follow `CLAUDE.md`. Read the README of each folder you change first, and update it in the same task, in the template.
- Done means `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. Rust changes also pass `cargo clippy --all-targets -- -D warnings` and `cargo test`.
- Commits have no Co-Authored-By line. Work on the current branch.
- Other sessions commit to this branch. Run `git status` before each task, and stage only your own files, by name.
- An untouched project plays, exports and saves exactly as before: `animation` stays absent until used.
- All times are integer `Micros`. Stored key times are content time, never timeline time. Command inputs are timeline time.
- A gesture updates the DOM or canvas directly and sends one command on release (rules 15, 24). For drawing, `animatedClip` is called only in `resolveFrame` and `visibleLayers`.
- `project` never imports `element`. Core modules read `Clip.animation` as data and never import `keyframe`.
- Key colors follow the prototype: an empty diamond is `border-subtle-foreground`, animated `text-on`, on a key `bg-mark`. Sharp shapes, except curve handles (rule 35, Task 12).
- Presets, in order, with exact numbers: Linear; Ease in `.42,0,1,1`; Ease out `0,0,.58,1`; Ease `.42,0,.58,1`; Snap `.16,1,.3,1`; Anticipate `.36,0,.66,-.56`; Overshoot `.34,1.56,.64,1`; Bounce; Elastic; Hold.
- The panel's header column is 262 px. Normal gives the width back.

## Review Focus

1. **Editing an animated field while the playhead is outside the clip:** the key lands on the clip's nearest frame, never outside it, and the inspector shows that frame's value. Tested in Task 4.
2. **Frozen and reversed clips with keys:** a held frame still animates along the timeline, and a reversed clip's animation plays forward. Tested in Task 1.
3. **A curve that overshoots a limited value:** opacity above 1 or scale below 0.01 clamps to the property's range instead of breaking the draw. Tested in Task 1.
4. **Keys that no longer exist:** a selection left behind by an undo or an agent's delete fails with `keyframe.not_found`, writes nothing, and the view forgets those keys. Tested in Task 5.
5. **A patch that touches an animated field and a static one in the same group:** `{ transform: { x, y } }` with only `x` keyed writes a key for `x` and a static `y`. Tested in Task 4.

---

## Stage 1: Values and playback

### Task 1: Types, curves and evaluation

**Files:**

- Create: `src/modules/project/logic/ease.ts`, `ease.test.ts`, `animate.ts`, `animate.test.ts`, `content.ts`, `content.test.ts` (all in `logic/`)
- Modify: `src/modules/project/project.types.ts`, `src/modules/project/project.geometry.ts`, `src/modules/project/index.ts`, `src/modules/project/README.md`

**Interfaces:**

- Produces, in `project.types.ts`:
  ```ts
  type KeyValue = number | string | boolean;
  type KeyEase =
    | { kind: "linear" }
    | { kind: "hold" }
    | { kind: "bezier"; x1: number; y1: number; x2: number; y2: number }
    | { kind: "named"; name: "bounce" | "elastic" };
  interface Keyframe { id: string; t: Micros; value: KeyValue; ease?: KeyEase; smooth?: true }
  interface KeyTrack {
    blend: "number" | "color" | "step";
    shared?: true;
    min?: number;
    max?: number;
    after?: "loop" | "pingpong";
    keys: Keyframe[];
  }
  // On Clip:
  animation?: Record<string, KeyTrack>;
  animationOrigin?: Micros;
  ```
- Produces, exported from `project`:
  - `EasePresetId = "linear" | "in" | "out" | "ease" | "snap" | "anticipate" | "overshoot" | "bounce" | "elastic" | "hold"`.
  - `EASE_PRESETS: readonly { id: EasePresetId; label: string; ease: KeyEase }[]`, `easeProgress(ease: KeyEase | undefined, u: number): number`, `presetOf(ease: KeyEase | undefined): EasePresetId | "custom"`.
  - `trackValue(track: KeyTrack, t: Micros): KeyValue`, `animatedClip(clip: Clip, time: Micros): Clip`.
  - `contentTime(clip, time): Micros`, `timeOfContent(clip, t): Micros`, `clampToClip(clip, time): Micros`, where `clip` is `Pick<Clip, "start" | "duration" | "speed" | "animationOrigin">`.

- [ ] **Step 1: Write the failing tests**

```ts
// content.test.ts
it("is the clip's own time from its origin", () => {
  expect(contentTime({ start: 2 * S, duration: 4 * S, animationOrigin: 500 }, 3 * S)).toBe(S + 500);
});
it("speeds up with the picture", () => {
  const clip = {
    start: 0,
    duration: 4 * S,
    speed: { rate: 2, pitchCorrection: true, reversed: false },
  };
  expect(contentTime(clip, S)).toBe(2 * S);
  expect(timeOfContent(clip, 2 * S)).toBe(S);
});
it("keeps running on a held frame", () => {
  const held = {
    start: 0,
    duration: 3 * S,
    speed: { rate: 0, pitchCorrection: true, reversed: false },
  };
  expect(contentTime(held, S)).toBe(S);
});
it("runs forward on a reversed clip", () => {
  const back = {
    start: 0,
    duration: 4 * S,
    speed: { rate: 1, pitchCorrection: true, reversed: true },
  };
  expect(contentTime(back, S)).toBe(S);
});
it("clamps a time to the clip's frames", () => {
  expect(clampToClip({ start: S, duration: S }, 0)).toBe(S);
  expect(clampToClip({ start: S, duration: S }, 9 * S)).toBe(2 * S - 1);
});

// ease.test.ts
it("runs every preset from 0 to 1", () => {
  for (const { ease } of EASE_PRESETS.filter((p) => p.id !== "hold")) {
    expect(easeProgress(ease, 0)).toBeCloseTo(0);
    expect(easeProgress(ease, 1)).toBeCloseTo(1);
  }
});
it("holds until the end", () => expect(easeProgress({ kind: "hold" }, 0.99)).toBe(0));
it("overshoots with Overshoot", () => {
  const over = EASE_PRESETS.find((p) => p.id === "overshoot")!.ease;
  expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map((u) => easeProgress(over, u)))).toBeGreaterThan(1);
});
it("names a handmade curve custom", () =>
  expect(presetOf({ kind: "bezier", x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 })).toBe("custom"));

// animate.test.ts
const track = (keys: Partial<Keyframe>[], rest: Partial<KeyTrack> = {}): KeyTrack => ({
  blend: "number",
  keys: keys.map((k, i) => ({ id: `k${i}`, t: 0, value: 0, ...k })),
  ...rest,
});
it("blends numbers, and holds outside the keys", () => {
  const t = track([
    { t: S, value: 0 },
    { t: 3 * S, value: 100 },
  ]);
  expect(trackValue(t, 2 * S)).toBeCloseTo(50);
  expect(trackValue(t, 0)).toBe(0);
  expect(trackValue(t, 9 * S)).toBe(100);
});
it("blends colors per channel", () => {
  const t = track(
    [
      { t: 0, value: "#000000" },
      { t: S, value: "#ffffff" },
    ],
    { blend: "color" },
  );
  expect(trackValue(t, S / 2)).toBe("#808080");
});
it("steps enums to the left key", () => {
  const t = track(
    [
      { t: 0, value: "normal" },
      { t: S, value: "screen" },
    ],
    { blend: "step" },
  );
  expect(trackValue(t, S - 1)).toBe("normal");
  expect(trackValue(t, S)).toBe("screen");
});
it("clamps an overshoot to the range", () => {
  const ease = { kind: "bezier", x1: 0.34, y1: 3, x2: 0.64, y2: 1 } as const;
  const t = track(
    [
      { t: 0, value: 0, ease },
      { t: S, value: 1 },
    ],
    { min: 0, max: 1 },
  );
  expect(trackValue(t, S / 2)).toBe(1);
});
it("loops and ping-pongs after the last key", () => {
  const keys = [
    { t: 0, value: 0 },
    { t: S, value: 100 },
  ];
  expect(trackValue(track(keys, { after: "loop" }), 1.5 * S)).toBeCloseTo(50);
  expect(trackValue(track(keys, { after: "pingpong" }), 1.25 * S)).toBeCloseTo(75);
});
it("gives back the same object for a clip with no animation", () => {
  const clip = { id: "c", start: 0, duration: S, sourceIn: 0, trackId: "t", kind: "x", props: {} };
  expect(animatedClip(clip, 0)).toBe(clip);
});
it("writes shared and nested values, and leaves the saved clip alone", () => {
  const clip: Clip = {
    id: "c",
    start: 0,
    duration: S,
    sourceIn: 0,
    trackId: "t",
    kind: "x",
    props: { outline: { width: 1 } },
    animation: {
      "transform.x": track([{ t: 0, value: 50 }], { shared: true }),
      "outline.width": track([{ t: 0, value: 9 }]),
    },
  };
  const now = animatedClip(clip, 0);
  expect(clipTransform(now)).toEqual({ ...IDENTITY_TRANSFORM, x: 50 });
  expect(now.props.outline).toEqual({ width: 9 });
  expect(clip.transform).toBeUndefined();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run src/modules/project/logic/ease.test.ts src/modules/project/logic/animate.test.ts src/modules/project/logic/content.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Add the types, and implement `ease.ts`, `content.ts` and `animate.ts`**

`contentTime` doesn't go through `sourceTimeAt`, so a reversed clip still runs forward:

```ts
const played = rate === 0 ? time - clip.start : Math.round((time - clip.start) * rate);
return (clip.animationOrigin ?? 0) + played;
```

`timeOfContent` inverts it. `easeProgress` solves the bezier's x by bisection over 24 steps. `presetOf` compares numbers exactly. Colors blend per channel on the `#rrggbb` value and round. `clipTransform` becomes `{ ...IDENTITY_TRANSFORM, ...clip.transform, ...live }`, so partial values from `animatedClip` work. Rotation isn't normalized here.

- [ ] **Step 4: Run them to verify they pass, and update the README**

Run: the same command, then `pnpm typecheck`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/project
git commit -m "feat(project): key tracks, curves and a clip's values at a time"
```

### Task 2: Key editing logic

**Files:**

- Create: `src/modules/project/logic/keys.ts`, `keys.test.ts`
- Modify: `src/modules/project/index.ts`

**Interfaces:**

- Consumes: the types from Task 1.
- Produces, exported from `project`, all pure (they return new values, so they work in commands and inside `produce`):
  - `writeKey(track: KeyTrack, t: Micros, value: KeyValue, tolerance: Micros, ease?: KeyEase): KeyTrack`: updates the key within `tolerance`, keeping its id and ease, else inserts one with a new `createId("key")` and the previous key's ease.
  - `moveTrackKeys(track: KeyTrack, moves: ReadonlyMap<string, Micros>, tolerance: Micros): KeyTrack`: sets new times, removes unmoved keys a moved key lands on, sorts.
  - `withoutKeys(track: KeyTrack, ids: ReadonlySet<string>): KeyTrack | undefined`: undefined when none is left.
  - `withoutTracks(animation: Record<string, KeyTrack> | undefined, drop: (path: string, track: KeyTrack) => boolean): Record<string, KeyTrack> | undefined`: undefined when none is left.
  - `mirrorEase(ease: KeyEase | undefined): KeyEase | undefined`: the same segment played backwards.

- [ ] **Step 1: Write the failing tests**

```ts
const base: KeyTrack = {
  blend: "number",
  keys: [
    { id: "a", t: 0, value: 0, ease: { kind: "hold" } },
    { id: "b", t: S, value: 1 },
  ],
};
it("updates the key within tolerance and keeps its id", () => {
  const next = writeKey(base, S + 10, 5, 100);
  expect(next.keys.map((k) => [k.id, k.t, k.value])).toEqual([
    ["a", 0, 0],
    ["b", S, 5],
  ]);
});
it("inserts in order with the previous key's ease", () => {
  const next = writeKey(base, S / 2, 5, 100);
  expect(next.keys.map((k) => k.t)).toEqual([0, S / 2, S]);
  expect(next.keys[1]!.ease).toEqual({ kind: "hold" });
});
it("replaces a key a moved key lands on", () => {
  const next = moveTrackKeys(base, new Map([["a", S]]), 100);
  expect(next.keys.map((k) => k.id)).toEqual(["a"]);
});
it("drops an empty track", () => expect(withoutKeys(base, new Set(["a", "b"]))).toBeUndefined());
it("mirrors a bezier", () =>
  expect(mirrorEase({ kind: "bezier", x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 })).toEqual({
    kind: "bezier",
    x1: 0.7,
    y1: 0.6,
    x2: 0.9,
    y2: 0.8,
  }));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/modules/project/logic/keys.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `logic/keys.ts`**

- [ ] **Step 4: Run it to verify it passes**

Run: the same command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/project
git commit -m "feat(project): write, move and remove keys"
```

### Task 3: Keys through trim, split and playback

**Files:**

- Modify: `src/modules/timeline/logic/placement.ts`, `src/modules/timeline/timeline.split.commands.ts`, `src/modules/timeline/timeline.commands.test.ts`, `src/modules/composition/composition.group.command.ts`, `src/modules/preview/logic/frame.ts`, `src/modules/transform/logic/layers.ts`, `src/modules/text/ui/TextEditor.tsx`, `src/modules/workspace/logic/format.ts`, `src/modules/workspace/logic/format.test.ts`, the READMEs of `timeline`, `composition`, `preview`, `transform`, `text`, `workspace`

**Interfaces:**

- Consumes: `animatedClip`, `contentTime` from Task 1.
- Produces: nothing new. `clampTrim`'s parameter widens to include `animation` and `animationOrigin`, and it returns `animationOrigin` when `clip.animation` is set.

- [ ] **Step 1: Write the failing tests**

In `timeline.commands.test.ts`, with a 4 s clip at `start: S` carrying `animation: { "transform.x": { blend: "number", shared: true, keys: [{ id: "k0", t: 0, value: 0 }, { id: "k1", t: 4 * S, value: 40 }] } }`:

```ts
it("keeps keys on the picture through a left trim", async () => {
  const before = animatedClip(clipOf(id), 3 * S);
  await run(kernel.bus.run(trimClip, { clipId: id, edge: "start", time: 2 * S }));
  expect(clipTransform(animatedClip(clipOf(id), 3 * S))).toEqual(clipTransform(before));
});
it("gives both halves of a split the same curve", async () => {
  const { created } = await run(kernel.bus.run(splitAt, { at: 3 * S, clipIds: [id] }));
  expect(clipOf(created[0]!).animation).toEqual(clipOf(id).animation);
  expect(contentTime(clipOf(created[0]!), 3 * S)).toBe(contentTime(clipOf(id), 3 * S));
});
```

In `format.test.ts`: a project whose clip has `animation` and `animationOrigin` decodes equal after `encodeProject`, the envelope says version 3, and a version 2 file opens.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run src/modules/timeline/timeline.commands.test.ts src/modules/workspace/logic/format.test.ts`
Expected: FAIL on the new cases.

- [ ] **Step 3: Move the origin where a clip's start is cut**

- `clampTrim`, start edge: add `...(clip.animation && { animationOrigin: contentTime(clip, start) })`.
- `splitClips`: add `...(target.animation && { animation: structuredClone(target.animation), animationOrigin: contentTime(target, at) })` to `base`.
- `trimToSpan` in `composition.group.command.ts`: before moving `clip.start`, `if (clip.animation) clip.animationOrigin = contentTime(clip, end)`.
- `logic/paste.ts` and duplicates need nothing: they `structuredClone` the clip.

- [ ] **Step 4: Apply values where clips are read**

- `preview/logic/frame.ts`: the active push uses `animatedClip(clip, time)`, and the upcoming push `animatedClip(clip, clip.start)`. `inside` keeps the original clip.
- `transform/logic/layers.ts`: `const clip = animatedClip(saved, time)` right after the `time` checks, used for the transform and `elements.resolve`.
- `text/ui/TextEditor.tsx`: `clipTransform(animatedClip(clip, playback.getTime()))`, read once when the editor opens.
- `workspace/logic/format.ts`: `VERSION = 3`.

**Note on Composite:** if `clipComposite` is in the repo, make it merge over its defaults as `clipTransform` now does, because `animatedClip` writes partial shared values. If it isn't yet, add that line to `docs/superpowers/plans/2026-11-02-solids-composite-gradients.md`, Task 1.

- [ ] **Step 5: Run the tests**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add <the files above>
git commit -m "feat(timeline): keys stay on the picture through trims, and play in preview"
```

### Task 4: `element`: keys through `setProps`, and what can be keyed

**Files:**

- Create: `src/modules/element/logic/animated.ts`, `src/modules/element/logic/keyable.ts`, `src/modules/element/element.commands.test.ts`
- Modify: `src/modules/element/element.commands.ts`, `element.guards.ts`, `element.types.ts`, `element.mcp.ts`, `index.ts`, `README.md`, `src/modules/transform/transform.commands.ts`, `src/modules/transform/ui/transform.gesture.ts`, `src/modules/composition/composition.settings.commands.ts`, the READMEs of `transform` and `composition`

**Interfaces:**

- Consumes: `writeKey`, `withoutTracks`, `clampToClip`, `contentTime`, `frameDuration`.
- Produces:
  - `setProps` input gains `at: z.number().int().min(0).optional()`.
  - `splitAnimated(clip: Clip, patch: Record<string, unknown>, element: ResolvedElement): { keyed: Map<string, unknown>; rest: Record<string, unknown> }`.
  - `keyableFields(element: ResolvedElement, clip: Clip, track: Track): KeyableField[]`, exported from `element`, with
    `interface KeyableField { path: string; spec: PropSpec; blend: KeyTrack["blend"]; shared: boolean }`.
  - `PropUi.keyframes?: false`.

- [ ] **Step 1: Write the failing tests**

```ts
it("writes a key at `at` for an animated field, and a static value for the rest", async () => {
  await run(
    kernel.bus.run(setProps, { clipIds: [id], patch: { transform: { x: 40, y: 7 } }, at: 2 * S }),
  );
  const clip = clipOf(id);
  expect(clip.animation!["transform.x"]!.keys.map((k) => k.value)).toEqual([0, 40]);
  expect(clip.transform!.y).toBe(7);
});
it("refuses an animated field without `at`", async () => {
  const failed = await kernel.bus.run(setProps, { clipIds: [id], patch: { transform: { x: 40 } } });
  expect(failed.error.code).toBe("element.animated");
  expect(failed.error.message).toContain("keyframe_set");
});
it("lands on the clip's last frame when the playhead is past it", async () => {
  await run(
    kernel.bus.run(setProps, { clipIds: [id], patch: { transform: { x: 40 } }, at: 99 * S }),
  );
  const times = clipOf(id).animation!["transform.x"]!.keys.map((k) => k.t);
  expect(Math.max(...times)).toBeLessThan(clipOf(id).duration);
});
it("removes tracks with what it resets", async () => {
  await run(kernel.bus.run(resetProps, { clipIds: [id], paths: ["transform"] }));
  expect(clipOf(id).animation).toBeUndefined();
});
it("lists numbers, colors, enums and booleans, and not text, read-only or opted-out fields", () => {
  const paths = keyableFields(element, clip, videoTrack).map((f) => f.path);
  expect(paths).toContain("transform.x");
  expect(paths).not.toContain("content");
});
```

Use a test element with a number, a color, a string, a `readOnly` number and a `keyframes: false` number.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run src/modules/element`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement**

- `splitAnimated` walks the patch's leaves. A leaf whose path is in `clip.animation` goes to `keyed`, the rest stays in `rest`. A group's patch with nothing left is dropped.
- `setProps`: after `parsePatch`, with any `keyed` field and no `at`, throw `CommandFailure("element.animated", ...)`, naming the path and `keyframe_set`, before writing anything. With `at`, `const t = contentTime(clip, clampToClip(clip, at))`, `tolerance = frameDuration(format) / 2`, and each keyed field goes through `writeKey`. `ClipWrite` gains `animation?: Record<string, KeyTrack>`, and `write`'s changed check compares it.
- `resetProps`: drop tracks whose path equals or sits under a reset path, and with no paths all tracks that aren't `shared`.
- `transform.reset` drops tracks under `transform.`.
- `transform.gesture.ts` passes `at: preview.playback.getTime()`.
- `composition.settings.commands.ts`: while scaling, each key value of `transform.x`, `transform.y` and `transform.scale` is scaled by running it through `scaleTransform` as that one field.
- `element_describe` adds `keyable: string[]` per element, without a track, by leaving out the group `appliesTo` check.

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add <the files above>
git commit -m "feat(element): animated fields write keys, and fields say if they can be keyed"
```

### Task 5: The `keyframe` module and its edit commands

**Files:**

- Create: `src/modules/keyframe/index.ts`, `keyframe.ref.ts`, `keyframe.module.ts`, `keyframe.types.ts`, `keyframe.points.ts`, `keyframe.fields.ts`, `keyframe.commands.ts`, `keyframe.edit.commands.ts`, `keyframe.guards.ts`, `keyframe.mcp.ts`, `keyframe.view.store.ts`, `keyframe.commands.test.ts`, `README.md`
- Modify: `src/app/bootstrap.ts`

**Interfaces:**

- Consumes: `keyableFields`, `setProps` from `element`; `writeKey`, `moveTrackKeys`, `withoutKeys`, `animatedClip`, `contentTime`, `timeOfContent`, `clampToClip` from `project`.
- Produces, in `keyframe.types.ts`:
  ```ts
  interface KeyRef {
    clipId: ClipId;
    path: string;
    keyId: string;
  }
  interface KeyField {
    path: string;
    label: string;
    blend: KeyTrack["blend"];
    shared?: true;
    min?: number;
    max?: number;
    /** enum: the allowed values. */
    values?: readonly string[];
    /** False where a track can't loop (speed). */
    loops?: false;
    /** The value now, with `clip` already at the time wanted. */
    read(clip: Clip): KeyValue;
    /** Makes `value` the static value, for when the last key goes. */
    commitStatic(ctx: CommandContext, clipId: ClipId, value: KeyValue): Promise<unknown>;
  }
  interface KeyTarget {
    id: string;
    fields(clip: Clip, track: Track): readonly KeyField[];
    /** Runs in the same command, after a track of this target changed. */
    afterWrite?(ctx: CommandContext, clipId: ClipId, before: Clip): void | Promise<void>;
  }
  interface KeyframeApi {
    /** Every field of a clip that can be keyed. */
    fieldsOf(clip: Clip): readonly KeyField[];
    readonly view: StoreApi<KeyframeViewState>;
  }
  interface KeyframeViewState {
    mode: "normal" | "keys" | "curves";
    /** The view K goes back to. */
    last: "keys" | "curves";
    maximized: boolean;
    scope: "selected" | "all";
    folded: ClipId[];
    selection: KeyRef[];
    /** `clipId:path` of curves on show. */
    shown: string[];
    primary: string | null;
    panelHeight: number;
    /** The last click was in the panel. */
    focused: boolean;
  }
  ```
- Produces, in `keyframe.points.ts`: `keyTargets` (keyed by `id`).
- Produces commands, `keyframeModule`, and `keyframeRef`. Module: `tier: "feature"`, `requires: ["project", "element"]` for now. Task 7 adds `preview` and `inspector`, and Task 9 adds `timeline` (rule 9).

| Command              | Input                                                          | Fails with                                                                  |
| -------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `keyframe.set`       | `{ clipId, path, at, value?, ease? }`                          | `keyframe.clip_not_found`, `keyframe.not_keyable`, `keyframe.invalid_value` |
| `keyframe.remove`    | `{ keys: KeyRef[] }`                                           | `keyframe.not_found`                                                        |
| `keyframe.move`      | `{ keys: (KeyRef & { value?: KeyValue })[], delta }`           | `keyframe.not_found`, `keyframe.invalid_value`                              |
| `keyframe.setValues` | `{ keys: (KeyRef & { value?: KeyValue; offset?: number })[] }` | same                                                                        |
| `keyframe.clear`     | `{ clipId, paths, at }`                                        | `keyframe.clip_not_found`                                                   |

- [ ] **Step 1: Write the failing tests**

Load the kernel as `speed.commands.test.ts` does, plus `keyframeModule`, with a test element like Task 4's and the clip at `start: 2 * S`.

```ts
it("adds a key with the current value at a timeline time", async () => {
  const { key } = await run(bus.run(set, { clipId, path: "transform.x", at: 3 * S }));
  expect(trackOf(clipId, "transform.x").keys).toEqual([
    expect.objectContaining({ id: key, t: S, value: 0 }),
  ]);
});
it("copies the field's limits to the track", async () => {
  await run(bus.run(set, { clipId, path: "transform.scale", at: 2 * S }));
  expect(trackOf(clipId, "transform.scale")).toMatchObject({
    blend: "number",
    shared: true,
    min: 0.01,
    max: 20,
  });
});
it("refuses a field that can't be keyed and a value out of range", async () => {
  expect((await bus.run(set, { clipId, path: "content", at: 0 })).error.code).toBe(
    "keyframe.not_keyable",
  );
  expect(
    (await bus.run(set, { clipId, path: "transform.scale", at: 0, value: 99 })).error.code,
  ).toBe("keyframe.invalid_value");
});
it("moves keys of two clips as one undo step", async () => {
  await run(bus.run(move, { keys: [refA, refB], delta: S }));
  expect(keyTime(refA)).toBe(oldA + S);
  expect(keyTime(refB)).toBe(oldB + S);
  await run(bus.run(undo, {}));
  expect(keyTime(refA)).toBe(oldA);
  expect(keyTime(refB)).toBe(oldB);
});
it("writes nothing when any key is gone", async () => {
  const failed = await bus.run(move, { keys: [refA, { ...refB, keyId: "gone" }], delta: S });
  expect(failed.error.code).toBe("keyframe.not_found");
  expect(keyTime(refA)).toBe(oldA);
});
it("forgets selected keys that are gone", async () => {
  api.view.setState({ selection: [refA] });
  await run(bus.run(remove, { keys: [refA] }));
  expect(api.view.getState().selection).toEqual([]);
});
it("leaves the last key's value as the static value", async () => {
  await run(bus.run(remove, { keys: [onlyKey] }));
  expect(clipOf(clipId).animation).toBeUndefined();
  expect(clipOf(clipId).transform!.x).toBe(40);
});
it("clears a track to the value at `at`", async () => {
  await run(bus.run(clear, { clipId, paths: ["transform.x"], at: 2 * S }));
  expect(clipOf(clipId).animation).toBeUndefined();
  expect(clipOf(clipId).transform!.x).toBeCloseTo(valueThereBefore);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/modules/keyframe`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the module**

- `keyframe.fields.ts`: `elementTarget(ctx): KeyTarget`, built on `keyableFields`. `read` uses `getPath(elements.resolve(clip, format), path)`. `commitStatic` runs `setProps` with a `pathPatch`-style nested patch and no `at`, after the track is gone. Export `getPath` from `element` if it isn't yet.
- `keyframe.guards.ts`: `requireKey(state, ref)`, `requireField(api, clip, path)`, `checkKeyValue(field, value)` (a number in `min..max`, a `#rrggbb` color lowercased, one of `values`, a boolean, by `blend` and `values`).
- `keyframe.move`: each key's new time is `contentTime(clip, timeOfContent(clip, k.t) + delta)`. Tolerance is half a frame of the clip's format. Everything is validated before the one `ctx.mutate`, then each changed target's `afterWrite` runs.
- A new track copies `blend`, `shared`, `min`, `max` from the field.
- The view store's `prune(state)` drops selected refs that no longer exist. Subscribe it to the project store in `setup`, and register the unsubscribe with `ctx.onDispose` (rule 12).
- `keyframe.mcp.ts` wraps each command with `commandTool`, as `keyframe_set`, `keyframe_remove`, `keyframe_move`, `keyframe_set_values`, `keyframe_clear`.
- List `keyframeModule` in `src/app/bootstrap.ts`, after `timelineModule`'s features.
- Every command, tool and `index.ts` export has TSDoc (rule 31).

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/keyframe src/app/bootstrap.ts
git commit -m "feat(keyframe): add, move and remove keys, for the user and for agents"
```

### Task 6: Curves, clipboard and reads for agents

**Files:**

- Create: `src/modules/keyframe/keyframe.ease.commands.ts`, `keyframe.clipboard.commands.ts`
- Modify: `keyframe.commands.ts`, `keyframe.commands.test.ts`, `keyframe.mcp.ts`, `keyframe.types.ts`, `README.md`

**Interfaces:**

- Consumes: `EASE_PRESETS`, `mirrorEase`, `trackValue`, `animatedClip`, Task 5's guards.
- Produces:

| Command / tool                             | Input                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `keyframe.setEase` / `keyframe_set_ease`   | `{ changes: { key: KeyRef; ease?: KeyEase \| EasePresetId; smooth?: boolean }[] }`      |
| `keyframe.setAfter` / `keyframe_set_after` | `{ clipId, path, after: "hold" \| "loop" \| "pingpong" }`                               |
| `keyframe.scale` / `keyframe_scale`        | `{ keys: KeyRef[], pivot, factor }`, with `pivot` a timeline time and `factor` non-zero |
| `keyframe.copy` / `keyframe_copy`          | `{ keys: KeyRef[] }`, not undoable, per `ctx.actor`                                     |
| `keyframe.paste` / `keyframe_paste`        | `{ at, clipIds }`; fails with `keyframe.no_target`                                      |
| `keyframe_sample` (read)                   | `{ clipId, path, from, to, step }`, at most 1000 samples, returns `{ time, value }[]`   |
| `keyframe_list_eases` (read)               | none, returns `EASE_PRESETS`                                                            |

`setAfter` with `after: "hold"` removes the field. On a field with `loops: false` it fails with `keyframe.no_loop`.

- [ ] **Step 1: Write the failing tests**

```ts
it("sets a preset by name on many keys", async () => {
  await run(bus.run(setEase, { changes: [{ key: refA, ease: "overshoot" }, { key: refB, ease: "overshoot" }] }));
  expect(presetOf(keyOf(refA).ease)).toBe("overshoot");
});
it("reverses keys with a negative factor, mirroring their curves", async () => {
  await run(bus.run(scale, { keys: [k0, k1], pivot: 2 * S, factor: -1 }));
  expect(timesOf(track)).toEqual([...oldTimes].reverse().map(mirrorAround(2 * S)));
  expect(keyOf(k1).ease).toEqual(mirrorEase(oldEaseOfK0));
});
it("pastes onto matching paths at a time, and only those", async () => {
  await run(bus.run(copy, { keys: [xKey] }));
  await run(bus.run(paste, { at: 5 * S, clipIds: [other] }));
  expect(trackOf(other, "transform.x").keys).toHaveLength(1);
  expect((await bus.run(paste, { at: 0, clipIds: [audioClip] })).error.code).toBe("keyframe.no_target");
});
it("keeps each actor's copy apart", ...);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/modules/keyframe`
Expected: FAIL.

- [ ] **Step 3: Implement**

Paste places the earliest copied key at `at`, keeps spacing, and skips paths the clip doesn't have. The clipboard is a `Map<ActorId, CopiedKeys>` made in `setup`, not at module level (rule 12). `keyframe.scale` rounds times to `Micros`, and with a negative factor moves each segment's ease to its new left key through `mirrorEase`.

- [ ] **Step 4: Run it to verify it passes, and finish Stage 1 in the real app**

Run: `pnpm test && pnpm typecheck && pnpm lint`. Then with `pnpm tauri dev` and the MCP tools, animate `transform.x` and `transform.scale`, check `preview_capture_frame` at two times, and export a short file.
Expected: PASS, the frames differ, and the exported picture moves the same way.

- [ ] **Step 5: Commit**

```bash
git add src/modules/keyframe
git commit -m "feat(keyframe): curves, loops, stretch, copy and paste, reads for agents"
```

## Stage 2: Inspector

### Task 7: Diamonds and values at the playhead

**Files:**

- Create: `src/modules/inspector/ui/clip.values.hook.ts`, `src/modules/keyframe/ui/KeyAction.tsx`, `src/modules/keyframe/ui/index.ts`
- Modify: `src/modules/inspector/inspector.types.ts`, `index.ts`, `README.md`, `ui/ClipSection.tsx`, `ui/FieldItem.tsx`, `ui/PropertySection.tsx`, `ui/props.live.hook.ts`, `src/modules/keyframe/keyframe.module.ts`, `src/modules/keyframe/README.md`

**Interfaces:**

- Consumes: `keyframe.set`, `keyframe.remove`, `KeyframeApi.fieldsOf`, `clampToClip`, `animatedClip`.
- Produces:
  - `FieldActionProps.clip: PanelSubject`.
  - `useClipAtPlayhead(clip: Clip): Clip`, exported from `inspector`. For a clip without `animation` it returns `clip` and subscribes to nothing. Otherwise it reads `playback.onTime`, computes `animatedClip(clip, clampToClip(clip, time))` at most every 100 ms while playing, and sets state only when the values differ (`deepEqual`).
  - `keyframeModule` gains `requires: "preview", "inspector"` and contributes the `fieldActions` entry `keyframe.key`, order 10, `appliesTo` checking the spec's kind.

- [ ] **Step 1: Pass the clip to field actions, and commit at the playhead**

`FieldItem` and `PropertySection` pass `clip` to `FieldActions`. `usePropsLive`'s `commit` becomes `bus.run(setProps, { clipIds: [id], patch, at: preview.playback.getTime() })`, and `read` resolves `animatedClip(now, clampToClip(now, playback.getTime()))`, so `livePatchChanged` compares against what's shown.

- [ ] **Step 2: Show values at the playhead**

`ClipSection`: `const shown = useClipAtPlayhead(clip)`, and `values` resolves `shown`.

- [ ] **Step 3: Add `KeyAction`**

A previous arrow, a diamond and a next arrow, using `IconButton`. It acts on those of `paths` that can be keyed, so Position's row keys X and Y together and a color keys with its opacity. Pressing the diamond adds keys at the playhead, or removes the ones there. Arrows seek with `preview.seek` to the nearest key time of any of the paths. It subscribes to `playback.onTime` imperatively and sets `data-state` (`off`, `animated`, `on-key`) on a ref, with no React state (rule 24). In a row, `FieldRow`'s value takes `text-on` when animated and `text-mark` on a key, through the same data attribute.

- [ ] **Step 4: Check it in the app**

Run: `pnpm typecheck && pnpm lint && pnpm test`, then in `pnpm tauri dev`: select a clip, press Scale's diamond, move the playhead, drag the slider, and undo.
Expected: PASS. The drag adds one key, one undo removes it, and the value follows the playhead while playing with no dropped frames.

- [ ] **Step 5: Commit**

```bash
git add <the files above>
git commit -m "feat(keyframe): diamonds in the inspector, and values that follow the playhead"
```

## Stage 3: Panel

### Task 8: Timeline offers tools, docks and a header width

**Files:**

- Create: `src/modules/timeline/ui/header.width.hook.ts`
- Modify: `src/modules/timeline/timeline.points.ts`, `timeline.types.ts`, `timeline.store.ts`, `timeline.layout.ts`, `index.ts`, `README.md`, `ui/TimelinePanel.tsx`, `ui/TimelineToolbar.tsx`, `ui/TimelineClip.tsx`, `ui/Ruler.tsx`, `ui/Playhead.tsx`, `ui/TrackHeader.tsx`, `ui/TrackInsert.tsx`, `src/modules/collab/ui/AgentPlayheads.tsx`, `src/modules/composition/ui/EndMarker.tsx`

**Interfaces:**

- Produces, from `timeline`:

  ```ts
  interface TimelineTool { id: string; order: number; component: ComponentType }
  interface TimelineDock { id: string; component: ComponentType }
  // New points: timelineTools (toolbar, left, by order), timelineDocks (under the tracks).
  // TimelineViewState gains headerWidth: number and tracksHidden: boolean.
  // TimelineApi gains:
  setHeaderWidth(px: number | null): void;     // null is HEADER_WIDTH
  setTracksHidden(hidden: boolean): void;
  scrollLeft(): number;
  setScrollLeft(px: number): void;
  zoomAt(clientX: number, pxPerSecond: number): void;
  // ClipActions gains:
  badge?: ComponentType<{ clip: Clip; selected: boolean }>;
  // Hook:
  useHeaderWidth(): number;
  ```

- [ ] **Step 1: Replace every use of `HEADER_WIDTH`**

The 10 files that read it use `useHeaderWidth()`, or `timeline.view.getState().headerWidth` in handlers. `HEADER_WIDTH` stays exported as the default. `TimelinePanel`'s Ctrl+wheel handler moves into `zoomAt`.

- [ ] **Step 2: Add the points**

`TimelineToolbar` draws `timelineTools` first, before Split, with a `ToolbarSeparator` when there are any. `TimelinePanel` draws `timelineDocks` under the scroller. When `tracksHidden`, the scroller shrinks to `RULER_HEIGHT` plus its scrollbar, so the ruler, zoom and scroll position stay. `TimelineClip` draws every `badge` in a `pointer-events-none` layer whose children may turn pointer events back on.

- [ ] **Step 3: Check nothing moved**

Run: `pnpm typecheck && pnpm lint && pnpm test`, then look at the timeline in the app, with `setHeaderWidth(262)` called from the console once.
Expected: PASS. Clips, ruler, playhead, agent playheads and the end marker all stay aligned at both widths.

- [ ] **Step 4: Update the docs and commit**

Add both points to rule 13 of `CLAUDE.md` and to the points table in `docs/modules.md`.

```bash
git add <the files above> CLAUDE.md docs/modules.md
git commit -m "feat(timeline): points for toolbar tools and docks, and a header width that can change"
```

### Task 9: The switch and the panel

**Files:**

- Create: `src/modules/keyframe/keyframe.view.commands.ts`, `keyframe.layout.ts`, `logic/range.ts`, `ui/ModeSwitch.tsx`, `ui/KeyPanel.tsx`, `ui/PanelToolbar.tsx`, `ui/PanelPlayhead.tsx`, `ui/ClipGroup.tsx`, `ui/PropertyRow.tsx`, `ui/KeyBand.tsx`, `ui/KeyDiamond.tsx`, `ui/panel.scroll.hook.ts`, `ui/panel.rows.hook.ts`
- Modify: `src/modules/keyframe/keyframe.module.ts`, `keyframe.commands.ts`, `ui/index.ts`, `README.md`

**Interfaces:**

- Consumes: Task 8's points and API, `selectionSubject`, `timeToPx`, `timeOfContent`, `KeyframeApi`.
- Produces:
  - `keyframe.toggleMode`: `{ mode?: "normal" | "keys" | "curves" }`, not undoable, no tool (like `media.reveal`: it's the user's view). Without `mode` it flips between `normal` and `last`. It sets the header width, clears `maximized` and `setTracksHidden(false)` in Normal.
  - `PANEL_HEADER_WIDTH = 262`, `ROW_HEIGHT = 24`, `MIN_PANEL_HEIGHT = 120` in `keyframe.layout.ts`.
  - `keysInWindow(track: KeyTrack, clip: Clip, from: Micros, to: Micros): { key: Keyframe; time: Micros; inside: boolean }[]` in `logic/range.ts`. `inside` is false past the clip's ends.
  - `usePanelRows(): PanelClip[]`, with `interface PanelClip { clip: Clip; fields: readonly KeyField[] }`. It holds selected clips (or every animated clip of the open composition with scope `all`), and only clips with keys. Fields are the animated ones.
  - `usePanelScroll(ref)`: mirrors `timeline.onScroll` to a `translateX` on the plane, and forwards wheel: `deltaX` or Shift to `setScrollLeft`, Ctrl to `zoomAt`.

- [ ] **Step 1: Add the command and view changes**

Contribute `ModeSwitch` to `timelineTools` with order 0: a `SegmentedControl` with `{ normal: "Normal", keys: "Keyframes", curves: "Curves" }`. Contribute the K binding to `keybindings`, resolving to `keyframe.toggleMode`.

- [ ] **Step 2: Build the panel**

`KeyPanel` (contributed to `timelineDocks`) renders nothing in Normal. Otherwise, top to bottom: a drag divider setting `panelHeight` directly, `PanelToolbar`, then the left column and the plane in one vertically scrolling box.

- `PanelToolbar`: **Showing: selected clips / all animated**, **Add key at playhead** (on the primary row), **Copy**, **Paste**, **Select all keys**, **Fit**, **Motion path**, **Maximize / Restore tracks** (`setTracksHidden`). Disabled buttons are for tasks not done yet, so add each with its task.
- `ClipGroup`: fold arrow, clip name, and the summary band with a diamond per distinct time.
- `PropertyRow`: swatch, label, value at the playhead (subscribed imperatively, text set on a ref), previous, diamond, next.
- `KeyBand`: `keysInWindow` for the page window (the same page ± 1 the panel reads from `pxPerSecond` and scroll, rule 26) with `KeyDiamond`s at `timeToPx(time)`. Keys with `inside: false` are `opacity-40`. Square for `blend: "step"`, rounded for an eased key, red when selected.
- `PanelPlayhead`: subscribes to `playback.onTime`, and sets `transform` on a ref.
- Contribute the clip arrow and small diamonds through `ClipActions.badge`, drawn only on selected clips with keys. The diamonds show in Normal, and the arrow opens the last view.

- [ ] **Step 3: Check it in the app**

Run: `pnpm typecheck && pnpm lint && pnpm test`, then in `pnpm tauri dev`: switch all three ways, press K, fold clips, Maximize, resize the divider, Ctrl+wheel over the panel, and compare with `keyframes-v4.html`.
Expected: PASS. Keys line up with the clips above at any zoom and scroll, and Normal looks exactly like today's timeline apart from the switch.

- [ ] **Step 4: Commit**

```bash
git add src/modules/keyframe
git commit -m "feat(keyframe): the Normal, Keyframes and Curves switch, and the panel"
```

### Task 10: Selecting and moving keys

**Files:**

- Create: `src/modules/keyframe/logic/moves.ts`, `logic/picking.ts`, `ui/key.gesture.ts`, `ui/box.gesture.ts`, `ui/panel.keys.hook.ts`
- Modify: `ui/KeyBand.tsx`, `ui/ClipGroup.tsx`, `ui/KeyPanel.tsx`, `ui/PanelToolbar.tsx`, `README.md`

**Interfaces:**

- Consumes: `keyframe.move`, `keyframe.remove`, `keyframe.copy`, `keyframe.paste`, `KeyframeApi.view`.
- Produces:
  - `clampDelta(items: readonly MovedKey[], delta: Micros): Micros` in `logic/moves.ts`, with `interface MovedKey { time: Micros; clipStart: Micros; clipEnd: Micros }`. Keys that start inside their clip stay inside. Keys that start outside don't limit the move.
  - `keysInBox(boxes: readonly KeyBox[], box: ScreenBox): KeyRef[]` in `logic/picking.ts`.
  - `startKeyDrag(options: KeyDragOptions): void` and `startBoxSelect(options: BoxSelectOptions): void`.

- [ ] **Step 1: Select**

Click selects one key, Ctrl+click toggles, a click on empty plane clears. A summary diamond selects every key of that clip at that time. **Select all keys** selects everything in `usePanelRows`. Any press in the panel sets `focused: true`, and a press on a track sets it false, through a `pointerdown` listener in `panel.keys.hook.ts`.

- [ ] **Step 2: Move**

`key.gesture.ts`: on `pointermove`, take `clampDelta`, then `transform` the selected diamonds' elements, found by `data-key-ref`. On release, one `keyframe.move`. Escape cancels. `box.gesture.ts` draws a `border-primary bg-primary-soft/40` box, and picks by each diamond's center on release.

- [ ] **Step 3: The keyboard**

`panel.keys.hook.ts` adds a `keydown` listener on `window` in the capture phase. It runs before `installKeybindings`, whose listener is on `window` in the bubble phase. With `focused` true, keys selected, and not typing, Delete or Backspace, Ctrl+C and Ctrl+V run the key commands and call `e.stopPropagation()`. Otherwise it does nothing, so the clip shortcuts work as today. No change in `src/app` or `src/core`.

- [ ] **Step 4: Fit, Copy and Paste**

**Fit** zooms so the selected clips fill the panel, with `setZoom` and `setScrollLeft`. **Copy** and **Paste** use the selection, and paste onto selected clips at the playhead.

- [ ] **Step 5: Check it in the app**

Run: `pnpm typecheck && pnpm lint && pnpm test`, then in `pnpm tauri dev`: box-select across two clips, drag, undo once, press Delete, undo, click a clip, press Delete.
Expected: PASS. The drag is one undo step, Delete takes keys while the panel has focus, and takes the clip after clicking on the tracks.

- [ ] **Step 6: Commit**

```bash
git add src/modules/keyframe
git commit -m "feat(keyframe): select and move keys across clips"
```

## Stage 4: Curves

### Task 11: The graph

**Files:**

- Create: `src/modules/keyframe/logic/graph.ts`, `ui/CurveGraph.tsx`, `ui/curve.draw.ts`, `ui/curve.gesture.ts`
- Modify: `ui/KeyPanel.tsx`, `ui/PropertyRow.tsx`, `keyframe.layout.ts`, `README.md`

**Interfaces:**

- Consumes: `trackValue`, `timeOfContent`, `keyframe.move` with `value`, `picking.ts`.
- Produces:
  - `valueScale(track: KeyTrack, clip: Clip, height: number, padding: number): { toY(value: number): number; toValue(y: number): number; low: number; high: number }`, sampled over the clip's span so overshoot fits.
  - `drawCurves(ctx: CanvasRenderingContext2D, scene: CurveScene): void`, with `interface CurveScene { curves: ShownCurve[]; pxPerSecond: number; scrollLeft: number; width: number; height: number; selection: ReadonlySet<string> }`.
  - `CURVE_COLORS`, four token names in `keyframe.layout.ts`, read through `getComputedStyle`, assigned by row order: `--mark`, `--primary`, `--foreground`, `--muted-foreground` (rule 34: palette scales are for brand art).

- [ ] **Step 1: Draw**

`CurveGraph` is one canvas, sized to the plane and redrawn from `scrollLeft`, the project, view state and zoom, never per frame. Grid at each second, a center line, each shown curve in its color, the primary stronger with its `high` and `low` at the left. Keys are diamonds, red when selected. Tracks with `blend: "step"` or `"color"` show no curve, and their rows stay. A row's swatch shows if it's on. Clicking a row toggles its curve and makes it primary.

- [ ] **Step 2: Select and move**

Box select and Ctrl+click as in Task 10, by `picking.ts`. `curve.gesture.ts` moves selected keys in time and value, each by its own scale. Shift locks to the axis with the larger movement, and it redraws on a `requestAnimationFrame`. On release, one `keyframe.move` carries `delta` and each key's `value`.

- [ ] **Step 3: Check it in the app**

Run: `pnpm typecheck && pnpm lint && pnpm test`, then with X in pixels and Opacity or Scale shown together, drag keys of two clips, then undo.
Expected: PASS. Each curve keeps its own scale, playback stays smooth with the graph open, and the drag is one undo step.

- [ ] **Step 4: Commit**

```bash
git add src/modules/keyframe
git commit -m "feat(keyframe): the curves graph, with keys moving in time and value"
```

### Task 12: Handles and predefined curves

**Files:**

- Create: `src/modules/keyframe/logic/handles.ts`, `ui/handle.gesture.ts`, `ui/PresetStrip.tsx`, `ui/EaseThumb.tsx`
- Modify: `ui/CurveGraph.tsx`, `ui/curve.draw.ts`, `ui/KeyPanel.tsx`, `ui/PanelToolbar.tsx`, `keyframe.module.ts`, `README.md`, `CLAUDE.md`

**Interfaces:**

- Consumes: `keyframe.setEase`, `EASE_PRESETS`, `presetOf`, `easeProgress`.
- Produces:
  - `handlePoints(left: Keyframe, right: Keyframe): { out: Point; in: Point }`, in content time and value.
  - `alignedEase(before: KeyEase, moved: "in" | "out", segments: SegmentPair): KeyEase`: the other side's handle keeps its length and takes the moved handle's slope in real units.
  - `EaseThumb({ ease })`: an SVG path of 40 samples of `easeProgress`, 42 by 24.

- [ ] **Step 1: Handles**

The primary curve's selected keys show handles, round like EQ points, for `bezier` segments on either side. `linear` segments show none until one's made `bezier` by **Smooth handles** or a preset, and `named` segments never show any (spec). `handle.gesture.ts` updates x (clamped 0 to 1) and free y, redraws only that curve, and on release sends one `keyframe.setEase` with the one or two changed segments. On a `smooth` key it runs `alignedEase`.

- [ ] **Step 2: The strip**

`PresetStrip` shows in Keyframes and Curves, under the panel: every preset as an `EaseThumb` with its label, plus Custom (dashed, not clickable, marked when `presetOf` says so). A click sends `keyframe.setEase` for all selected keys. The current preset takes `border-mark` when all selected keys agree. **Smooth handles** toggles `smooth` on the selection. F9 is a `keybindings` entry resolving to `keyframe.setEase` with `ease` on the selection, or null with none selected.

- [ ] **Step 3: Update rule 35**

In `CLAUDE.md`: "only avatars, switch and slider thumbs, EQ points and curve handles are round".

- [ ] **Step 4: Check it in the app**

Run: `pnpm typecheck && pnpm lint && pnpm test`, then pick each preset, drag a handle past the top of the graph so it overshoots, turn on Smooth, press F9, and compare with `keyframes-v4.html`.
Expected: PASS. The strip marks Custom after a drag, an overshoot on opacity flattens at 100%, and export matches the preview at a few frames.

- [ ] **Step 5: Commit**

```bash
git add src/modules/keyframe CLAUDE.md
git commit -m "feat(keyframe): handles and predefined curves"
```

## Stage 5: Extras

### Task 13: Motion path

**Files:**

- Create: `src/modules/keyframe/logic/motion.ts`, `ui/MotionPath.tsx`, `ui/motion.gesture.ts`
- Modify: `keyframe.module.ts`, `ui/PanelToolbar.tsx`, `keyframe.view.store.ts`, `keyframe.types.ts`, `README.md`

**Interfaces:**

- Consumes: `previewOverlays`, `keyframe.setValues`, `trackValue`, `clipPlacement`.
- Produces: `motionPath(clip: Clip, format: ProjectFormat, samples: number): { points: FramePoint[]; keys: { ref: KeyRef[]; at: FramePoint }[] }`, and `KeyframeViewState.motionPath: boolean`, default true.

- [ ] **Step 1: Draw it**

Contribute a `previewOverlays` entry, an SVG in % of the frame. It shows when the panel is open, the switch is on, and one clip is selected with a `transform.x` or `transform.y` track: a dashed `stroke-primary` path of 120 samples, and a diamond at each key time. It's DOM, so it never reaches a capture or an export.

- [ ] **Step 2: Drag it**

The overlay turns pointer events on for diamonds only. `motion.gesture.ts` moves the diamond directly, and on release sends one `keyframe.setValues` for the X and Y keys at that time. Where only one axis has a key at that time, the other axis' change is dropped.

- [ ] **Step 3: Check it, and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`, then drag a path point in the app, undo, and check that `preview_capture_frame` shows no path.
Expected: PASS.

```bash
git add src/modules/keyframe
git commit -m "feat(keyframe): the motion path on the canvas"
```

### Task 14: Stretch, reverse, loop and snapping

**Files:**

- Create: `src/modules/keyframe/logic/snap.ts`
- Modify: `ui/key.gesture.ts`, `ui/curve.gesture.ts`, `ui/KeyPanel.tsx`, `ui/PropertyRow.tsx`, `README.md`

**Interfaces:**

- Consumes: `keyframe.scale`, `keyframe.setAfter`, `SNAP_PX` (export it from `timeline`).
- Produces: `snapMove(delta: Micros, moving: readonly Micros[], targets: readonly Micros[], pxPerSecond: number, frame: Micros): Micros`: closest target within `SNAP_PX`, else rounded so the first moving key lands on a frame.

- [ ] **Step 1: Snap**

`key.gesture.ts` and `curve.gesture.ts` run `snapMove` after `clampDelta`, with the playhead, the clip edges and the unselected keys as targets. Holding Ctrl turns snapping to targets off, and frame rounding stays.

- [ ] **Step 2: Stretch and reverse**

With two or more keys selected, the plane draws a thin bracket around them. Alt-dragging its end stretches from the other end, and release sends one `keyframe.scale`. A right click on a selection opens a `ContextMenu` with **Reverse keys** (`factor: -1`, pivot at the middle), Copy, Delete, and the presets.

- [ ] **Step 3: Loop**

A row's right-click menu has **After the last key**: Hold, Loop, Ping-pong, sending `keyframe.setAfter`, and **Remove animation**, sending `keyframe.clear` at the playhead. A looping row shows a repeat icon from `lucide-react`.

- [ ] **Step 4: Check it, and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`, then stretch a selection, reverse it, loop a track and press play.
Expected: PASS.

```bash
git add src/modules/keyframe src/modules/timeline/index.ts
git commit -m "feat(keyframe): snapping, stretch, reverse and loops"
```

## Stage 6: Sound

### Task 15: Volume and pan keys, in preview

**Files:**

- Create: `src/modules/audio/audio.keys.ts`
- Modify: `src/modules/audio/audio.module.ts`, `audio.commands.ts`, `ui/SoundRow.tsx`, `README.md`, `src/modules/project/logic/sound.ts`, `src/modules/keyframe/index.ts`, `src/modules/keyframe/keyframe.commands.test.ts`

**Interfaces:**

- Consumes: `keyTargets`, `KeyTarget`, `KeyField` from `keyframe`.
- Produces: the `audio.keys` target, with `sound.volumeDb` (`min: -60, max: 12`) and `sound.pan` (`min: -1, max: 1`), `shared: true`, on clips of audio tracks. `commitStatic` runs `audio.setSound`. `audio.resetSound` drops tracks under `sound.`.

- [ ] **Step 1: Write the failing test**

```ts
it("keys a sound value on an audio clip", async () => {
  await run(bus.run(set, { clipId: audioClip, path: "sound.volumeDb", at: S, value: -6 }));
  expect(soundOf(animatedClip(clipOf(audioClip), S)).volumeDb).toBe(-6);
  expect(soundOf(animatedClip(clipOf(audioClip), S)).pan).toBe(0);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/modules/keyframe`
Expected: FAIL with `keyframe.not_keyable`.

- [ ] **Step 3: Implement**

`soundOf` becomes `{ ...DEFAULT_SOUND, ...clip.sound }` when `clip.sound` is set. The engine reads `soundOf(clip)` on the clip from `resolveFrame`, which is already animated, so preview needs nothing more. Add `keyframe` to the module's `requires`, contribute the target, and show `KeyAction` at the end of `SoundRow` for Volume and Pan (export it from `keyframe`, with `clip` and `paths` as props).

- [ ] **Step 4: Run it to verify it passes, and listen**

Run: `pnpm test && pnpm typecheck && pnpm lint`, then in the app key a fade down over a music clip.
Expected: PASS, with no clicks in preview.

- [ ] **Step 5: Commit**

```bash
git add src/modules/audio src/modules/project src/modules/keyframe
git commit -m "feat(audio): volume and pan can be keyed"
```

### Task 16: Volume and pan in export

**Files:**

- Create: `src/modules/export/logic/envelope.ts`
- Modify: `src/modules/export/logic/mixdown.ts`, `logic/mixdown.test.ts`, `export.types.ts`, `README.md`, `src-tauri/src/export/recipe.rs`

**Interfaces:**

- Consumes: `trackValue`, `contentTime`, `dbToLinear`.
- Produces:
  - `envelope(value: (time: Micros) => number, from: Micros, to: Micros): EnvelopePoint[]`, with `interface EnvelopePoint { at: Micros; value: number }`: samples every 100 ms, drops points on a straight line within 0.001, at most 256 points, `at` relative to the segment.
  - `SoundSegment.gainEnvelope?: EnvelopePoint[]`, `SoundSegment.panEnvelope?: EnvelopePoint[]`. When set they replace `gain` and `pan`. Rust fields use `#[serde(default)]`.

- [ ] **Step 1: Write the failing tests**

```ts
// mixdown.test.ts
it("gives a keyed clip a gain envelope", () => {
  const [segment] = mixdown(projectWithKeyedVolume, range);
  expect(segment!.gainEnvelope!.at(0)!.value).toBeCloseTo(1);
  expect(segment!.gainEnvelope!.at(-1)!.value).toBeCloseTo(dbToLinear(-12));
});
it("leaves a clip without keys as it was", () => {
  expect(mixdown(plainProject, range)[0]).not.toHaveProperty("gainEnvelope");
});
```

```rust
#[test]
fn gain_envelope_becomes_a_frame_expression() {
    let chain = sound_graph(&[keyed_segment()], 1, 2_000_000);
    assert!(chain.contains("volume=eval=frame:volume='"));
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run src/modules/export && (cd src-tauri && cargo test export)`
Expected: FAIL.

- [ ] **Step 3: Implement**

`envelope_expr(points)` in `recipe.rs` builds nested `if(lt(t,…),lerp…)`. Gain becomes `volume=eval=frame:volume='…'`. A pan envelope goes through `channelsplit`, a `volume` expression per side using the same law as `pan_filter`, then `join`. In `mixdown`, a keyed clip's envelope is `gain * dbToLinear(value)` at each point, with the crossfade gain as today. The clip's fades stay and multiply on top. The envelope sits after the tempo step, in timeline time, as fades do.

- [ ] **Step 4: Run them to verify they pass, and listen**

Run: `pnpm test && pnpm typecheck && pnpm lint && (cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test)`, then export the clip from Task 15.
Expected: PASS, and the file sounds like the preview.

- [ ] **Step 5: Commit**

```bash
git add src/modules/export src-tauri/src/export/recipe.rs
git commit -m "feat(export): keyed volume and pan"
```

## Stage 7: Speed ramps

Before starting, confirm clip speed's Preview/export, Freeze frame and Reverse tasks are merged: `git log --oneline --grep='feat(speed)'`, and `speed.freezeFrame` and `reversed` handling exist. If not, stop and report it.

### Task 17: The ramp

**Files:**

- Create: `src/modules/project/logic/ramp.ts`, `ramp.test.ts`, `src/modules/speed/speed.keys.ts`
- Modify: `src/modules/project/logic/speed.ts`, `logic/content.ts`, `index.ts`, `src/modules/timeline/logic/placement.ts`, `src/modules/speed/speed.module.ts`, `speed.commands.ts`, `speed.commands.test.ts`, `README.md`

The spec names `speed/logic/ramp.ts`, but `sourceTimeAt` is in `project`, which can't import a feature, so the table is in `project`.

**Interfaces:**

- Consumes: `KeyTarget.afterWrite(ctx, clipId, before)`, `retime` and `writeSpeed` from `speed/logic/retime.ts`.
- Produces, exported from `project`:
  - `RAMP_PATH = "speed.rate"`.
  - `rampTimeAt(track: KeyTrack, from: Micros, to: Micros): Micros`, the timeline length of content `from..to`: `∫ dc / rate(c)`, with one point per 1/120 s of content between the first and last key, and the first and last rate outside them. Cached in a `WeakMap` by track.
  - `rampContentAt(track: KeyTrack, from: Micros, elapsed: Micros): Micros`, its inverse, by bisection on the table.
  - `rateAt(clip, time): number`: the rate playing at a time, with or without a ramp.
- Changes: `sourceTimeAt`, `sourceSpan` and `contentTime` read the ramp when `clip.animation?.[RAMP_PATH]` is set. `timeOfContent` too. Their results for a clip without a ramp stay exactly as they are.

- [ ] **Step 1: Write the failing tests**

```ts
// ramp.test.ts
const ramp: KeyTrack = {
  blend: "number", min: 0.1, max: 10,
  keys: [{ id: "a", t: 0, value: 1 }, { id: "b", t: 2 * S, value: 4 }],
};
it("plays a constant part at its rate", () =>
  expect(rampTimeAt(ramp, 2 * S, 6 * S)).toBeCloseTo(S, -3));
it("inverts", () => {
  const taken = rampTimeAt(ramp, 0, 3 * S);
  expect(rampContentAt(ramp, 0, taken)).toBeCloseTo(3 * S, -3);
});
it("takes less time than the slowest rate would", () =>
  expect(rampTimeAt(ramp, 0, 2 * S)).toBeLessThan(2 * S));

// speed.commands.test.ts
it("shortens the clip when a ramp speeds it up, and moves what follows, in one undo", async () => {
  await run(bus.run(set, { clipId: id, path: "speed.rate", at: 0, value: 1 }));
  await run(bus.run(set, { clipId: id, path: "speed.rate", at: S, value: 4 }));
  expect(clipOf(id).duration).toBeLessThan(oldDuration);
  expect(clipOf(next).start).toBe(clipOf(id).start + clipOf(id).duration);
  await run(bus.run(undo, {}));
  expect(clipOf(next).start).toBe(afterFirstKey);
});
it("keeps the part of the file it plays", ...sourceSpan(clipOf(id)) equals the span before);
it("refuses a ramp on a reversed clip", ...error code "speed.reversed_ramp");
it("offers no speed.rate on a held frame", ...KeyframeApi.fieldsOf has no "speed.rate");
it("refuses a loop on speed.rate", ...error code "keyframe.no_loop");
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run src/modules/project/logic/ramp.test.ts src/modules/speed`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `ramp.ts`, then the ramp branch in `speed.ts` and `content.ts`.
- `clampTrim`: replace its `speedOf(clip).rate` sums with `sourceTimeAt` and the ramp functions on ramped clips.
- `speed.keys.ts`: a target with `speed.rate` (`min: 0.1`, `max: 10`, `loops: false`, `shared: true`) on clips where `canChangeSpeed`. `read` is `rateAt`. `commitStatic` runs `speed.set` with the rate.
- `afterWrite(ctx, clipId, before)`: `span = sourceSpan(before)`, `duration = rampTimeAt(track, origin, origin + span)` rounded, then the same `retime` ripple as `speed.set`, with the speed view's last Ripple choice, applied to linked partners too (each gets the same track).
- `speed.reset` drops the track. `speed.set` on a ramped clip fails with `speed.ramped`, naming `keyframe_clear`.
- A reversed clip refuses in `fields`' write path: `keyframe.set` runs `requireField`, and the target throws `speed.reversed_ramp`.
- `speed.freezeFrame`: the hold bakes the values at the playhead: `animatedClip(target, at)`'s keyed fields become static on the hold, with no `animation`, so the picture doesn't jump when the hold ends.
- `sameSpeed` also compares the ramp tracks, so `timeline.linkClips` stays safe.

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add <the files above>
git commit -m "feat(speed): speed ramps, where the clip gets shorter as it speeds up"
```

### Task 18: Ramps in preview and export

**Files:**

- Modify: `src/modules/preview/engine/engine.html.ts`, `engine/engine.sync.ts`, `src/modules/preview/logic/drift.ts`, `README.md`, `src/modules/export/logic/mixdown.ts`, `logic/mixdown.test.ts`, `export.types.ts`, `README.md`, `src-tauri/src/export/recipe.rs`, `src/modules/keyframe/ui/panel.rows.hook.ts`

**Interfaces:**

- Consumes: `rateAt`, `sourceTimeAt`, `timeOfContent`.
- Produces: `SoundSegment.tempoSteps?: { from: Micros; duration: Micros; speed: number }[]`, 250 ms of timeline time each, in file order, in one input. Rust fields use `#[serde(default)]`.

- [ ] **Step 1: Write the failing tests**

```ts
it("cuts a ramped clip's sound into tempo steps that cover it", () => {
  const [segment] = mixdown(rampedProject, range);
  const steps = segment!.tempoSteps!;
  expect(steps.reduce((sum, s) => sum + s.duration, 0)).toBe(segment!.duration);
  expect(steps[0]!.speed).toBeLessThan(steps.at(-1)!.speed);
});
```

```rust
#[test]
fn tempo_steps_trim_and_join() {
    let chain = sound_graph(&[ramped_segment()], 1, 2_000_000);
    assert!(chain.contains("atrim="));
    assert!(chain.contains("concat="));
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run src/modules/export && (cd src-tauri && cargo test export)`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Engine: each frame, set `element.playbackRate = rateAt(clip, time)`, only when it changed by more than 0.01. `syncSlot` and `driftSeek` use `sourceTimeAt`, with the drift limit read at the current rate. `previewProps` speed drags don't apply to a ramped clip.
- Export picture needs nothing: frames use `sourceTimeAt`.
- `mixdown`: a ramped clip's `from` is `sourceTimeAt(clip, start)`, and it's given `tempoSteps`.
- `recipe.rs`: for each step, `atrim` on the file's time, `asetpts`, `tempo_steps(speed)`, then `concat=n=…:v=0:a=1`, before fades and envelopes.

- [ ] **Step 4: Listen (gate)**

Run: `pnpm test && pnpm typecheck && pnpm lint && (cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test)`, then export a clip ramping 1x to 4x to 1x, with speech and music.
Expected: PASS. If the steps are audible, try 100 ms. If they still are, **stop and bring it back to the user** with both files. Don't ship a ramp that clicks.

- [ ] **Step 5: Show ramped clips in the panel, and commit**

`keysInWindow` draws every key through `timeOfContent`, so ramped clips work. Check that keys on other rows move with the picture when a ramp changes.

```bash
git add <the files above>
git commit -m "feat(speed): ramps play in preview and export"
```

## Finish

### Task 19: Docs, prune and the last pass

**Files:**

- Modify: `CLAUDE.md`, `docs/modules.md`, `src/modules/keyframe/README.md`, every test file this plan added to

- [ ] **Step 1: Finish `CLAUDE.md` and `docs/modules.md`**

- `CLAUDE.md`: scope gains keyframes. Where to look gains `keyframe/` and rule 13 gains `keyframe` reading `keyTargets`.
- `docs/modules.md`: a `keyframe` row in the tier table with its final `requires`, updated rows for `audio` and `speed`, and `keyTargets`, `timelineTools`, `timelineDocks` in the points table.
- Remove "keyframes" from every README's **Not yet** (`element`, `transform`, `inspector`).
- `Clip`'s comment in `project.types.ts` mentions `animation`.

- [ ] **Step 2: Prune tests**

Keep tests only for the kernel of playback (`ease`, `animate`, `content`, `ramp`), document integrity (`keys`, undoable `keyframe.*` commands, `element.setProps` with `at`, keys through trim and split, the workspace round trip) and the export recipe. Delete anything else this plan added, per rule 3.

- [ ] **Step 3: The whole pass in the real app**

Run: `pnpm typecheck && pnpm lint && pnpm test`, and `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test`. In `pnpm tauri dev`, repeat `keyframes-v4.html`'s flow on real footage: a logo move with Overshoot, a fade, two clips moved together, Normal, K, Maximize, save and reopen, export, and an agent animating a clip while you watch.
Expected: everything passes, the export matches the preview, and a project with no keys exports byte-for-byte the same recipe as before.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/modules.md <the files above>
git commit -m "docs(keyframe): finish the docs and prune tests"
```
