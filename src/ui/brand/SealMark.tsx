import { useId } from "react";

/**
 * The Cloudy Studio seal peeking over a canvas, adapted from Cloudy Canvas (`seal-logo.tsx`,
 * "mark" variant). Size it with `className` (e.g. `size-6`).
 */
export function SealMark({ className }: { className?: string }) {
  // `useId` may contain characters that break `url(#…)`, so keep only safe ones.
  const fur = `seal-fur-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient id={fur} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--seal-300)" />
          <stop offset="75%" stopColor="var(--seal-100)" />
        </linearGradient>
      </defs>
      <ellipse
        cx="32"
        cy="28"
        rx="20"
        ry="16.5"
        fill={`url(#${fur})`}
        stroke="var(--seal-900)"
        strokeWidth="2.4"
      />
      <ellipse cx="24" cy="15.5" rx="1.6" ry="1.1" fill="var(--seal-400)" />
      <ellipse cx="31" cy="12.6" rx="1.2" ry="0.8" fill="var(--seal-400)" />
      <ellipse cx="38.5" cy="14" rx="1.8" ry="1.2" fill="var(--seal-400)" />
      <ellipse cx="45" cy="19" rx="1.3" ry="1" fill="var(--seal-400)" />
      <ellipse cx="19.5" cy="26" rx="3" ry="1.8" fill="var(--blush-300)" opacity="0.8" />
      <ellipse cx="44.5" cy="26" rx="3" ry="1.8" fill="var(--blush-300)" opacity="0.8" />
      <path
        d="M21.5 22.5q3-3 6 0M36.5 22.5q3-3 6 0"
        fill="none"
        stroke="var(--seal-900)"
        strokeWidth="2.4"
      />
      <path
        d="M32 26.2c-1-1.6-5.6-1.6-6 1.4-.3 2.4 2.6 3.4 4.4 2.6.8-.3 1.3-.8 1.6-1.3.3.5.8 1 1.6 1.3 1.8.8 4.7-.2 4.4-2.6-.4-3-5-3-6-1.4z"
        fill="var(--seal-50)"
        stroke="var(--seal-900)"
        strokeWidth="1.9"
      />
      <ellipse cx="32" cy="25.9" rx="1.7" ry="1.15" fill="var(--seal-900)" />
      <rect
        x="8"
        y="33"
        width="48"
        height="25"
        rx="1.5"
        fill="#fff"
        stroke="var(--seal-900)"
        strokeWidth="2.4"
      />
      <ellipse
        cx="17.5"
        cy="34.5"
        rx="4.6"
        ry="2.6"
        transform="rotate(-18 17.5 34.5)"
        fill="var(--seal-300)"
        stroke="var(--seal-900)"
        strokeWidth="2.4"
      />
      <ellipse
        cx="46.5"
        cy="34.5"
        rx="4.6"
        ry="2.6"
        transform="rotate(18 46.5 34.5)"
        fill="var(--seal-300)"
        stroke="var(--seal-900)"
        strokeWidth="2.4"
      />
    </svg>
  );
}
