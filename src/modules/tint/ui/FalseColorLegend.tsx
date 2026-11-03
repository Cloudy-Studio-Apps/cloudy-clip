/** The bands false color paints, darkest first, with data colors. */
const BANDS = [
  ["crushed", "#8c1ad9", "#eceff1"],
  ["shadow", "#595959", "#eceff1"],
  ["mid gray", "#4dbf59", "#0e1013"],
  ["skin", "#f299b3", "#0e1013"],
  ["light", "#999999", "#0e1013"],
  ["near clip", "#f2d933", "#0e1013"],
  ["clipped", "#ff1a1a", "#0e1013"],
] as const;

/** What each false color means, along the bottom of the frame. */
export function FalseColorLegend() {
  return (
    <div className="absolute bottom-2 left-2 z-10 flex font-mono text-2xs font-bold">
      {BANDS.map(([name, background, color]) => (
        <span key={name} className="px-1.5 py-0.5" style={{ background, color }}>
          {name}
        </span>
      ))}
    </div>
  );
}
