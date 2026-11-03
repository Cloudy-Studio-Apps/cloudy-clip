/** Id of the SVG filter that paints brightness as bands of color. */
export const FALSE_COLOR_FILTER = "tint-false-color";

/** Twenty brightness steps, each painted as its band (see the legend). */
const BANDS = [
  [0.55, 0.1, 0.85],
  ...Array.from({ length: 6 }, () => [0.35, 0.35, 0.35]),
  ...Array.from({ length: 3 }, () => [0.3, 0.75, 0.35]),
  ...Array.from({ length: 3 }, () => [0.95, 0.6, 0.7]),
  ...Array.from({ length: 5 }, () => [0.6, 0.6, 0.6]),
  [0.95, 0.85, 0.2],
  [1, 0.1, 0.1],
] as const;

const table = (channel: 0 | 1 | 2) => BANDS.map((band) => band[channel]).join(" ");

/** The false color filter, defined once in the viewer. A stand-in until the GPU pass draws it. */
export function FalseColorFilter() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <filter id={FALSE_COLOR_FILTER} colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0"
        />
        <feComponentTransfer>
          <feFuncR type="discrete" tableValues={table(0)} />
          <feFuncG type="discrete" tableValues={table(1)} />
          <feFuncB type="discrete" tableValues={table(2)} />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}
