import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from "react";
import { cn } from "@/ui";

/**
 * A box exactly over the preview's canvas (inside the viewer frame): what is drawn in it, in
 * percent, sits on the picture whatever the viewer does. It follows the canvas each frame, writing
 * the DOM only when the place changes. Its children take pointer events when they ask to.
 */
export function FrameBox({
  stage,
  ref,
  className,
  children,
}: {
  stage: React.RefObject<HTMLElement | null>;
  ref?: Ref<HTMLDivElement | null>;
  className?: string;
  children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => box.current as HTMLDivElement);
  useEffect(() => {
    let frame = 0;
    let last = "";
    const follow = () => {
      const canvas = stage.current?.querySelector("canvas");
      const el = box.current;
      const parent = el?.offsetParent;
      if (canvas && el && parent) {
        const c = canvas.getBoundingClientRect();
        const p = parent.getBoundingClientRect();
        const place = [c.left - p.left, c.top - p.top, c.width, c.height];
        const key = place.join();
        if (key !== last) {
          last = key;
          const [left, top, width, height] = place.map((n) => `${n}px`);
          Object.assign(el.style, { left, top, width, height });
        }
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [stage]);
  return (
    <div ref={box} className={cn("pointer-events-none absolute z-10", className)}>
      {children}
    </div>
  );
}
