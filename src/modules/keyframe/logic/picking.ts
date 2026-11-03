import { timeOfContent, type Clip } from "@/modules/project";
import type { ScreenBox } from "@/modules/timeline";
import type { Micros } from "@/core";
import type { KeyBox, KeyRef } from "../keyframe.types";

/** The keys whose diamond's center lies in the box. */
export function keysInBox(boxes: readonly KeyBox[], box: ScreenBox): KeyRef[] {
  return boxes.flatMap(({ ref, box: b }) => {
    const x = (b.left + b.right) / 2;
    const y = (b.top + b.bottom) / 2;
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom ? [ref] : [];
  });
}

/** Every key of a clip at a timeline time: what its summary diamond stands for. */
export function keysAtTime(clip: Clip, time: Micros): KeyRef[] {
  return Object.entries(clip.animation ?? {}).flatMap(([path, track]) =>
    track.keys
      .filter((key) => timeOfContent(clip, key.t) === time)
      .map((key) => ({ clipId: clip.id, path, keyId: key.id })),
  );
}

/** The identity of a key in `data-key-ref` and in sets. */
export function refId(ref: KeyRef): string {
  return `${ref.clipId}|${ref.path}|${ref.keyId}`;
}

/** The key a `data-key-ref` names. */
export function parseRef(id: string): KeyRef | undefined {
  const [clipId, path, keyId] = id.split("|");
  return clipId && path && keyId ? { clipId, path, keyId } : undefined;
}

/** Toggles refs in a selection: all in, they come out; otherwise they are added. */
export function toggled(selection: readonly KeyRef[], refs: readonly KeyRef[]): KeyRef[] {
  const ids = new Set(refs.map(refId));
  const all = refs.every((r) => selection.some((s) => refId(s) === refId(r)));
  return all
    ? selection.filter((s) => !ids.has(refId(s)))
    : [...selection, ...refs.filter((r) => !selection.some((s) => refId(s) === refId(r)))];
}
