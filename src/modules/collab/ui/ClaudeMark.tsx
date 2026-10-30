/** Claude's mark, for an agent's avatar and pointer. Brand art, so it keeps its own colors. */
export function ClaudeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="16" fill="#f4efe6" />
      <path
        stroke="#d97757"
        strokeWidth="2.6"
        strokeLinecap="round"
        d="M16 6.5v19M6.5 16h19M9.3 9.3l13.4 13.4M22.7 9.3 9.3 22.7M12.4 7.2l7.2 17.6M19.6 7.2l-7.2 17.6M7.2 12.4l17.6 7.2M7.2 19.6l17.6-7.2"
      />
      <circle cx="16" cy="16" r="2.4" fill="#d97757" />
    </svg>
  );
}
