import { easeProgress, type KeyEase } from "@/modules/project";

const SAMPLES = 40;

/** A path of 40 samples of `easeProgress`, in a 42 by 24 box with room above and below for overshoot. */
function thumbPath(ease: KeyEase | undefined): string {
  let d = "";
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES;
    d += `${i ? "L" : "M"}${(u * 42).toFixed(1)} ${(22 - easeProgress(ease, u) * 18).toFixed(1)}`;
  }
  return d;
}

/** The little drawing of an ease on the preset strip. */
export function EaseThumb({ ease }: { ease: KeyEase }) {
  return (
    <svg
      width={42}
      height={24}
      viewBox="0 0 42 24"
      className="shrink-0 overflow-visible"
      aria-hidden
    >
      <path d={thumbPath(ease)} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}
