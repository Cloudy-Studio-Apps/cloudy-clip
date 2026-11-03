/** Action safe (90%) and title safe (80%) frames. */
export function GuidesOverlay() {
  return (
    <div className="pointer-events-none absolute inset-[5%] z-10 border border-dashed border-foreground/55">
      <div className="absolute inset-[6.25%] border border-dashed border-foreground/35" />
    </div>
  );
}
