interface RangeBarProps {
  label: string;
  /** CSS background of the bar: what the range runs over. */
  background: string;
  /** The picked window, in % of the bar. */
  from: number;
  to: number;
}

/** A range over a strip of hues, saturations or brightness, with its picked window. */
export function RangeBar({ label, background, from, to }: RangeBarProps) {
  return (
    <div className="flex h-8 items-center gap-2">
      <span className="w-[74px] shrink-0 text-base text-muted-foreground">{label}</span>
      <span
        className="relative h-4 min-w-0 flex-1 overflow-hidden rounded-xs"
        style={{ background }}
      >
        <span
          className="absolute -inset-y-px rounded-xs border-[1.5px] border-foreground shadow-[0_0_0_999px_rgb(14_16_19/0.55)]"
          style={{ left: `${from}%`, width: `${to - from}%` }}
        />
      </span>
      <span className="w-16 rounded-xs bg-background px-1.5 py-0.5 text-right font-mono text-sm">
        {from}–{to}
      </span>
    </div>
  );
}
