const LINE = "absolute bg-border-strong";
const CORNER = "absolute size-3.5 border-mark";

/**
 * The animator's frame chart around the picture: centre lines out to the stage's edges and four red
 * pencil corners. It's DOM over the canvas, so captures and exports never see it.
 */
export function FieldGuide() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <span className={`${LINE} right-full top-1/2 h-px w-screen`} />
      <span className={`${LINE} left-full top-1/2 h-px w-screen`} />
      <span className={`${LINE} bottom-full left-1/2 h-screen w-px`} />
      <span className={`${LINE} left-1/2 top-full h-screen w-px`} />
      <span className={`${CORNER} -left-[9px] -top-[9px] border-l-[1.5px] border-t-[1.5px]`} />
      <span className={`${CORNER} -right-[9px] -top-[9px] border-r-[1.5px] border-t-[1.5px]`} />
      <span className={`${CORNER} -bottom-[9px] -left-[9px] border-b-[1.5px] border-l-[1.5px]`} />
      <span className={`${CORNER} -bottom-[9px] -right-[9px] border-b-[1.5px] border-r-[1.5px]`} />
    </div>
  );
}
