import { DEMO_WHEELS } from "../demo/demo.values";

/** Data colors of the channels. */
const CHANNELS = [
  ["Y", "var(--foreground)"],
  ["R", "#e0545a"],
  ["G", "#4fbf6a"],
  ["B", "#4d8fe0"],
] as const;

/** The wheels as vertical bars per channel: one group per wheel. */
export function WheelBars() {
  return (
    <div className="flex gap-6">
      {DEMO_WHEELS.primary.map((wheel) => (
        <div key={wheel.label} className="flex flex-col items-center gap-2">
          <h5 className="font-hand text-base font-bold">{wheel.label}</h5>
          <div className="flex h-[150px] gap-2">
            {CHANNELS.map(([name, color]) => (
              <div key={name} className="flex flex-col items-center gap-1">
                <span className="relative block w-1.5 flex-1 rounded-xs bg-background">
                  <i
                    className="absolute inset-x-0 bottom-0 block h-1/2 rounded-xs"
                    style={{ background: color }}
                  />
                  <i className="absolute left-1/2 top-1/2 block size-2.5 -translate-1/2 rounded-full border-[1.5px] border-foreground bg-surface" />
                </span>
                <span className="font-mono text-2xs text-subtle-foreground">{name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
