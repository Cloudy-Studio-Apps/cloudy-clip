/** The peg bar that holds an animator's sheet: two slots and a round hole. Decoration only. */
export function PegBar() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[9px] flex -translate-x-1/2 items-center gap-[120px] max-[1400px]:hidden"
    >
      <i className="block h-[13px] w-[34px] rounded-[7px] bg-surface-sunken shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]" />
      <i className="block size-[15px] rounded-full bg-surface-sunken shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]" />
      <i className="block h-[13px] w-[34px] rounded-[7px] bg-surface-sunken shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]" />
    </div>
  );
}
