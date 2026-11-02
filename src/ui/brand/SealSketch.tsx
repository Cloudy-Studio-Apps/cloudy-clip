const DRAW = "motion-safe:[stroke-dasharray:1] motion-safe:[stroke-dashoffset:1]";
const ROUGH = `fill-none stroke-primary opacity-75 [stroke-width:0.5] motion-safe:animate-draw ${DRAW}`;
const FILL = "motion-safe:animate-appear motion-safe:opacity-0";
const BODY = "M60 6c30 0 54 20 54 49 0 25-24 39-54 39S6 80 6 55C6 26 30 6 60 6z";

/**
 * The foca watona drawing itself: blue roughs, then the pencil line, then its fills. It plays once
 * each time it mounts, and shows finished under reduced motion. Size it with `className`.
 */
export function SealSketch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 100" aria-hidden overflow="visible">
      <circle className={ROUGH} pathLength="1" cx="60" cy="50" r="46" />
      <path className={ROUGH} pathLength="1" d="M6 50c20 8 88 8 108 0" />
      <path className={ROUGH} pathLength="1" d="M60 2c-8 30-8 66 0 96" />
      <path className={FILL} fill="#dfe5e9" d={BODY} />
      <path
        className={`fill-none stroke-foreground motion-safe:animate-draw-line ${DRAW}`}
        pathLength="1"
        d={BODY}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g
        className="opacity-[0.32] motion-safe:animate-appear-soft motion-safe:opacity-0"
        fill="#22272e"
      >
        <ellipse cx="38" cy="19" rx="5" ry="3.2" transform="rotate(-24 38 19)" />
        <ellipse cx="53" cy="13" rx="3.2" ry="2.2" />
        <ellipse cx="70" cy="15" rx="5.2" ry="3" />
        <ellipse cx="86" cy="23" rx="4.2" ry="2.8" />
        <ellipse cx="24" cy="33" rx="3.6" ry="2.6" />
        <ellipse cx="97" cy="36" rx="3.8" ry="2.6" />
        <ellipse cx="22" cy="68" rx="3.8" ry="2.6" />
        <ellipse cx="96" cy="70" rx="4" ry="2.6" />
      </g>
      <g className={FILL} fill="#22272e">
        <path
          d="M60 58c-7-1-16 1-16 8 0 6 10 9 16 4 6 5 16 2 16-4 0-7-9-9-16-8z"
          fill="#f7f9fa"
          stroke="#22272e"
          strokeWidth="1.9"
        />
        <ellipse cx="40" cy="49" rx="6.4" ry="4.4" transform="rotate(10 40 49)" />
        <ellipse cx="80" cy="49" rx="6.4" ry="4.4" transform="rotate(-10 80 49)" />
        <path d="M55.5 56.5h9l-4.5 5z" stroke="#22272e" strokeWidth="1.6" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
