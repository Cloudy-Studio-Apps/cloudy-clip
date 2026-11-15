import { FALSE_COLOR_BANDS } from "../logic/bands";

const css = (rgb: readonly number[]) => `rgb(${rgb.map((c) => Math.round(c * 255)).join(" ")})`;

/** What each false color means, along the bottom of the frame (the bands the shader paints). */
export function FalseColorLegend() {
  return (
    <div className="absolute bottom-2 left-2 z-10 flex font-mono text-2xs font-bold">
      {FALSE_COLOR_BANDS.map(({ name, rgb, ink }) => (
        <span key={name} className="px-1.5 py-0.5" style={{ background: css(rgb), color: ink }}>
          {name}
        </span>
      ))}
    </div>
  );
}
