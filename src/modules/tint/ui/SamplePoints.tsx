/** Demo pins: where they sit (in % of the frame) and what they read. */
const PINS = [
  { u: 38, v: 46, read: "R 214 G 196 B 178", luma: 78 },
  { u: 72, v: 24, read: "R 188 G 190 B 186", luma: 74 },
] as const;

/** Pinned sample points and their readouts. */
export function SamplePoints() {
  return (
    <>
      {PINS.map((pin, i) => (
        <span
          key={i}
          className="pointer-events-none absolute z-10 size-3.5 -translate-1/2 rounded-full border-[1.5px] border-foreground shadow-[0_0_0_1px_black]"
          style={{ left: `${pin.u}%`, top: `${pin.v}%` }}
        >
          <b className="absolute -top-3.5 left-3 font-mono text-2xs text-foreground">{i + 1}</b>
        </span>
      ))}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-0.5 font-mono text-xs">
        {PINS.map((pin, i) => (
          <span key={i} className="rounded-xs bg-surface-sunken/85 px-1.5 py-0.5">
            {i + 1} {pin.read} <span className="text-subtle-foreground">· {pin.luma}%</span>
          </span>
        ))}
      </div>
    </>
  );
}
