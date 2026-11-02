import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { isKeyable } from "@/modules/element";
import type { FieldAction, FieldActionProps } from "@/modules/inspector";
import { previewRef, seek } from "@/modules/preview";
import { clampToClip, contentTime, projectRef, timeOfContent } from "@/modules/project";
import { IconButton } from "@/ui";
import { removeKeys, setKeys } from "../keyframe.edit.commands";
import { keyframeRef } from "../keyframe.ref";

/** Whether the keyed paths have keys: none, some, or one on the playhead's frame. */
type KeyState = "off" | "animated" | "on-key";

/** The diamond and the two arrows at the end of a row: add or remove keys at the playhead, jump between keys. */
function KeyActionView({ clip: subject, paths, disabled }: FieldActionProps) {
  const { bus } = useKernel();
  const { playback } = useModule(previewRef);
  const keyframes = useModule(keyframeRef);
  const project = useModule(projectRef).store;
  const clip = useStore(project.api, (s) => s.clips[subject.id]);
  const keyed = useMemo(() => {
    if (!clip) return [];
    const keyable = new Set(keyframes.fieldsOf(clip).map((f) => f.path));
    return paths.filter((p) => keyable.has(p));
  }, [clip, keyframes, paths]);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || !clip || keyed.length === 0) return;
    const row = el.closest<HTMLElement>("[data-field-row]");
    const update = () => {
      const time = playback.getTime();
      const at = contentTime(clip, clampToClip(clip, time));
      const tracks = keyed.flatMap((p) => clip.animation?.[p] ?? []);
      const state: KeyState =
        tracks.length === 0
          ? "off"
          : tracks.some((t) => t.keys.some((k) => k.t === at))
            ? "on-key"
            : "animated";
      el.dataset.state = state;
      if (row) row.dataset.keyState = state;
      const times = tracks.flatMap((t) => t.keys.map((k) => timeOfContent(clip, k.t)));
      const before = el.querySelector<HTMLButtonElement>("[data-dir=prev]");
      const after = el.querySelector<HTMLButtonElement>("[data-dir=next]");
      if (before) before.disabled = disabled || !times.some((t) => t < time);
      if (after) after.disabled = disabled || !times.some((t) => t > time);
    };
    const off = playback.onTime(update);
    return () => {
      off();
      if (row) delete row.dataset.keyState;
    };
  }, [clip, keyed, playback, disabled]);

  if (!clip || keyed.length === 0) return null;

  const toggle = async () => {
    const time = playback.getTime();
    const at = contentTime(clip, clampToClip(clip, time));
    const here = keyed.flatMap((path) =>
      (clip.animation?.[path]?.keys ?? [])
        .filter((k) => k.t === at)
        .map((k) => ({ clipId: clip.id, path, keyId: k.id })),
    );
    if (here.length > 0) {
      await bus.run(removeKeys, { keys: here });
      return;
    }
    await bus.run(setKeys, { clipId: clip.id, paths: keyed, at: time });
  };
  const jump = (dir: "prev" | "next") => {
    const time = playback.getTime();
    const times = keyed.flatMap((p) =>
      (clip.animation?.[p]?.keys ?? []).map((k) => timeOfContent(clip, k.t)),
    );
    const target =
      dir === "prev"
        ? Math.max(...times.filter((t) => t < time))
        : Math.min(...times.filter((t) => t > time));
    if (Number.isFinite(target)) void bus.run(seek, { time: target });
  };
  const small = "!size-[18px] [&_svg]:!size-3";
  return (
    <div ref={root} data-state="off" className="group/key flex shrink-0 items-center">
      <IconButton
        label="Previous keyframe"
        data-dir="prev"
        disabled
        className={small}
        onClick={() => jump("prev")}
      >
        <ChevronLeft />
      </IconButton>
      <IconButton
        label="Keyframe"
        disabled={disabled}
        className={small}
        onClick={() => void toggle()}
      >
        <span className="size-2 rotate-45 border-[1.5px] border-subtle-foreground group-data-[state=animated]/key:border-on group-data-[state=on-key]/key:border-mark group-data-[state=on-key]/key:bg-mark" />
      </IconButton>
      <IconButton
        label="Next keyframe"
        data-dir="next"
        disabled
        className={small}
        onClick={() => jump("next")}
      >
        <ChevronRight />
      </IconButton>
    </div>
  );
}

/** The keyframe field action: shows for every field that can hold keys. */
export const keyAction: FieldAction = {
  id: "keyframe.key",
  order: 10,
  appliesTo: isKeyable,
  component: KeyActionView,
};
