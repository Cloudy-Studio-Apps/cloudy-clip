import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { isTextClip, projectRef, type ClipId } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { TextEditor } from "./TextEditor";

/**
 * In-place editing of a text clip's words on the preview. Double-click the selected text in the
 * frame to open a textarea over it. While it is open a layer covers the frame, so the transform
 * tools never see the pointer. The overlay itself ignores the pointer when no edit is open.
 */
export function TextEditOverlay() {
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef);
  const { playback } = useModule(previewRef);
  const rootRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<ClipId | null>(null);
  const clip = useStore(project.api, (s) => (editing ? s.clips[editing] : undefined));

  useEffect(() => {
    const onDoubleClick = (event: MouseEvent) => {
      const root = rootRef.current;
      const target = event.target as Element | null;
      if (!root || !target || target.closest("textarea, input")) return;
      const rect = root.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!inside) return;
      // The first click of the double-click already selected the text under the pointer.
      const selection = timeline.view.getState().selection;
      const [id] = selection;
      const found = selection.length === 1 && id ? project.getState().clips[id] : undefined;
      const time = playback.getTime();
      if (
        !found ||
        !isTextClip(found) ||
        time < found.start ||
        time >= found.start + found.duration
      )
        return;
      event.preventDefault();
      setEditing(found.id);
    };
    document.addEventListener("dblclick", onDoubleClick);
    return () => document.removeEventListener("dblclick", onDoubleClick);
  }, [project, timeline, playback]);

  const textClip = clip && isTextClip(clip) ? clip : null;
  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0">
      {textClip && <TextEditor key={textClip.id} clip={textClip} onDone={() => setEditing(null)} />}
    </div>
  );
}
