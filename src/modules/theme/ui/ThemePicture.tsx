import type { ThemePreview } from "../theme.types";

/** A small picture of a theme: a window with a panel, lines of text and a primary button. */
export function ThemePicture({ preview }: { preview: ThemePreview }) {
  const { background, surface, primary, foreground } = preview;
  return (
    <div aria-hidden className="flex h-20 gap-1.5 p-2" style={{ background }}>
      <div className="flex w-1/3 flex-col gap-1 rounded-xs p-1.5" style={{ background: surface }}>
        <span className="h-1 w-3/4 rounded-xs opacity-80" style={{ background: foreground }} />
        <span className="h-1 w-1/2 rounded-xs opacity-40" style={{ background: foreground }} />
        <span className="h-1 w-2/3 rounded-xs opacity-40" style={{ background: foreground }} />
      </div>
      <div className="flex flex-1 flex-col justify-between rounded-xs p-1.5">
        <span className="h-1.5 w-1/2 rounded-xs opacity-70" style={{ background: foreground }} />
        <span className="h-3 w-10 self-end rounded-xs" style={{ background: primary }} />
      </div>
    </div>
  );
}
