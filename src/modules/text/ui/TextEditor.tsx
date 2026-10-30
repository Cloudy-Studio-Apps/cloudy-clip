import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import {
  type Clip,
  clipPlacement,
  clipTransform,
  type PictureSize,
  useOpenFormat,
} from "@/modules/project";
import { textFont, textLayout, textPadding, textStyleOf, clipText } from "../logic/layout";
import { canvasTextMeasure, setProps } from "@/modules/element";
import { EDIT_HIDDEN_STYLE, editCommitAction } from "../logic/editing";

interface TextEditorProps {
  clip: Clip;
  /** Called once the edit has ended (committed, reverted or unchanged). */
  onDone: () => void;
}

/**
 * A transparent textarea laid over a text clip, with its font, size, color, alignment and
 * spacing, scaled by the clip scale and the viewer zoom and rotated with the clip. It fills the
 * frame's coordinate space (output pixels) and is sized and placed straight on the DOM, so
 * typing, zoom and pan cause no React renders. Escape, blur or a click outside end the edit.
 */
export function TextEditor({ clip, onDone }: TextEditorProps) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const format = useOpenFormat();
  const style = useMemo(() => textStyleOf(clip, format), [clip, format]);
  const transform = useMemo(() => clipTransform(clip), [clip]);
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const ended = useRef(false);
  const measure = useMemo(
    () => canvasTextMeasure(document.createElement("canvas").getContext("2d")),
    [],
  );

  // Places the editor for the typed words: the same box and placement the canvas tools use.
  const place = useCallback(
    (words: string) => {
      const element = box.current;
      const frame = element?.parentElement;
      if (!element || !frame) return;
      const size: PictureSize = textLayout(words, style, measure).box;
      const placement = clipPlacement(format, size, transform, "none");
      const k = frame.clientWidth / format.width;
      Object.assign(element.style, {
        left: `${(placement.cx / format.width) * 100}%`,
        top: `${(placement.cy / format.height) * 100}%`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        transform: `translate(-50%, -50%) rotate(${placement.rotation}deg) scale(${k * transform.scale})`,
      });
    },
    [style, transform, format, measure],
  );

  const show = (words: string) =>
    preview.previewProps(clip.id, { ...EDIT_HIDDEN_STYLE, text: words });

  // Opens: hides the canvas text and selects the words. Closes: clears the live override.
  useEffect(() => {
    const field = area.current;
    if (!field) return;
    preview.previewProps(clip.id, { ...EDIT_HIDDEN_STYLE, text: field.value });
    field.focus();
    field.select();
    return () => preview.previewProps(clip.id, null);
  }, [preview, clip.id]);

  // Follows the typed words, the clip, and the frame's size (viewer zoom and panel resizes).
  useLayoutEffect(() => {
    const field = area.current;
    const frame = box.current?.parentElement;
    if (!field || !frame) return;
    place(field.value);
    const observer = new ResizeObserver(() => place(field.value));
    observer.observe(frame);
    return () => observer.disconnect();
  }, [place]);

  const finish = async () => {
    const field = area.current;
    if (ended.current || !field) return;
    ended.current = true;
    const words = field.value;
    // "revert" and "none" keep the saved words; only a real change is one `element.setProps`.
    if (editCommitAction(clipText(clip), words) === "commit") {
      await bus.run(setProps, { clipIds: [clip.id], patch: { text: words } });
    }
    onDone();
  };

  return (
    <>
      <div
        className="pointer-events-auto absolute inset-0 cursor-text"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void finish();
        }}
      />
      <div ref={box} className="pointer-events-none absolute">
        <textarea
          ref={area}
          aria-label="Edit words"
          wrap="off"
          spellCheck={false}
          defaultValue={clipText(clip)}
          onChange={(event) => {
            place(event.target.value);
            show(event.target.value);
          }}
          onBlur={() => void finish()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
              event.preventDefault();
              void finish();
            }
          }}
          className="pointer-events-auto block size-full resize-none overflow-hidden border-0 bg-transparent outline-none"
          style={{
            font: textFont(style),
            lineHeight: `${style.size * style.lineHeight}px`,
            letterSpacing: `${style.letterSpacing}px`,
            textAlign: style.align,
            textTransform: style.uppercase ? "uppercase" : "none",
            padding: `${textPadding(style)}px`,
            whiteSpace: "pre",
            color: style.fill.color,
            opacity: style.fill.opacity,
            caretColor: style.fill.color,
          }}
        />
      </div>
    </>
  );
}
