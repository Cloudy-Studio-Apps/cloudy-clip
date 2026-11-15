/** Action safe (90% of the picture) and title safe (80%) frames. Inside a `FrameBox`. */
export function GuidesOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-[5%] border border-dashed border-foreground/55" />
      <div className="absolute inset-[10%] border border-dashed border-foreground/35" />
    </div>
  );
}
