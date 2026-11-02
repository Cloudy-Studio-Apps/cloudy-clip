/**
 * The foca watona, as an animator's rough: spotted, with dark deadpan open eyes. It is wider than
 * tall (6:5), so size it with `className` (e.g. `h-6 w-7`). `rough` adds the blue construction
 * lines, for large sizes only. Colours are brand art, so they stay fixed in every theme.
 */
export function SealMark({ className, rough = false }: { className?: string; rough?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 120 100" aria-hidden>
      {rough && (
        <g fill="none" stroke="#6fb7e6" strokeWidth="0.9" opacity="0.8">
          <circle cx="60" cy="50" r="46" />
          <path d="M6 50c20 8 88 8 108 0M60 2c-8 30-8 66 0 96" />
        </g>
      )}
      <path
        d="M60 6c30 0 54 20 54 49 0 25-24 39-54 39S6 80 6 55C6 26 30 6 60 6z"
        fill="#dfe5e9"
        stroke="#eceff1"
        strokeWidth="2.2"
      />
      <g fill="#22272e" opacity="0.28">
        <ellipse cx="38" cy="19" rx="5" ry="3.2" transform="rotate(-24 38 19)" />
        <ellipse cx="53" cy="13" rx="3.2" ry="2.2" />
        <ellipse cx="70" cy="15" rx="5.2" ry="3" />
        <ellipse cx="86" cy="23" rx="4.2" ry="2.8" transform="rotate(30 86 23)" />
        <ellipse cx="24" cy="33" rx="3.6" ry="2.6" />
        <ellipse cx="97" cy="36" rx="3.8" ry="2.6" />
        <ellipse cx="22" cy="68" rx="3.8" ry="2.6" />
        <ellipse cx="96" cy="70" rx="4" ry="2.6" />
      </g>
      <ellipse cx="40" cy="49" rx="6.4" ry="4.4" transform="rotate(10 40 49)" fill="#22272e" />
      <ellipse cx="80" cy="49" rx="6.4" ry="4.4" transform="rotate(-10 80 49)" fill="#22272e" />
      <path
        d="M60 58c-7-1-16 1-16 8 0 6 10 9 16 4 6 5 16 2 16-4 0-7-9-9-16-8z"
        fill="#f7f9fa"
        stroke="#22272e"
        strokeWidth="1.9"
      />
      <path
        d="M55.5 56.5h9l-4.5 5z"
        fill="#22272e"
        stroke="#22272e"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
