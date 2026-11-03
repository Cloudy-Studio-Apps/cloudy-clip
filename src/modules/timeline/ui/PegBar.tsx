/**
 * The peg bar that holds an animator's sheet: two slots and a round hole. Decoration only. It
 * sits in the free space it's placed in, and hides when that space is too narrow for it.
 */
export function PegBar() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-center gap-[120px] @min-[340px]:flex"
    >
      <i className="block h-[13px] w-[34px] rounded-[7px] bg-surface-sunken shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]" />
      <i className="block size-[15px] rounded-full bg-surface-sunken shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]" />
      <i className="block h-[13px] w-[34px] rounded-[7px] bg-surface-sunken shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]" />
    </div>
  );
}
