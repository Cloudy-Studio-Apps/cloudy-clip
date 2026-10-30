import type { EditingShape } from "../../sticker.types";

/** A line in `color` with an outline, so it reads on any footage. */
const line =
  (d: string, width = 9) =>
  (color: string, outline: string) =>
    `<path d="${d}" fill="none" stroke="${outline}" stroke-width="${width + 7}"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"/>`;

/** Filled shapes in `color` with an outline. */
const solid = (shapes: string) => (color: string, outline: string) =>
  `<g fill="${outline}" stroke="${outline}" stroke-width="7">${shapes}</g>` +
  `<g fill="${color}">${shapes}</g>`;

/** A star of `points` tips around (64, cy), as a path. */
function star(points: number, outer: number, inner: number, cy = 64): string {
  const corners = Array.from({ length: points * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const x = 64 + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M${corners.join("L")}Z`;
}

/** The shapes of the Editing pack: things that point something out on video. */
export const EDITING_SHAPES: readonly EditingShape[] = [
  {
    id: "arrow",
    label: "Arrow",
    topic: "arrows",
    keywords: ["point", "right", "straight"],
    height: 64,
    draw: line("M10 32H106M84 12l26 20-26 20"),
  },
  {
    id: "arrow-curved",
    label: "Curved arrow",
    topic: "arrows",
    keywords: ["point", "turn"],
    draw: line("M22 106C28 56 60 30 102 30M78 12l26 18-22 22"),
  },
  {
    id: "arrow-hand",
    label: "Hand-drawn arrow",
    topic: "arrows",
    keywords: ["point", "sketch", "scribble"],
    draw: line("M14 98c20-14 30 4 44-14s26-24 46-50M82 30l24 2-2 24"),
  },
  {
    id: "arrow-double",
    label: "Double arrow",
    topic: "arrows",
    keywords: ["both", "swap", "between"],
    height: 64,
    draw: line("M18 32H110M40 12L14 32l26 20M88 12l26 20-26 20"),
  },
  {
    id: "circle",
    label: "Circle",
    topic: "marks",
    keywords: ["ring", "highlight", "focus"],
    draw: line("M64 16a48 48 0 1 0 0 96a48 48 0 1 0 0-96Z"),
  },
  {
    id: "circle-hand",
    label: "Hand-drawn circle",
    topic: "marks",
    keywords: ["ring", "highlight", "sketch", "scribble"],
    draw: line("M72 20C36 14 14 42 18 70c4 32 44 46 74 32 26-12 28-52 2-72-14-10-36-10-48-4"),
  },
  {
    id: "box",
    label: "Box",
    topic: "marks",
    keywords: ["rectangle", "frame", "highlight"],
    draw: line("M16 30H112V98H16Z"),
  },
  {
    id: "underline",
    label: "Underline",
    topic: "marks",
    keywords: ["line", "highlight", "stroke"],
    height: 32,
    draw: line("M10 18C44 8 84 26 118 12"),
  },
  {
    id: "cross",
    label: "Cross",
    topic: "marks",
    keywords: ["wrong", "no", "x"],
    draw: line("M30 30L98 98M98 30L30 98", 13),
  },
  {
    id: "check",
    label: "Check",
    topic: "marks",
    keywords: ["right", "yes", "ok", "done"],
    draw: line("M22 68l30 30 54-64", 13),
  },
  {
    id: "spark",
    label: "Spark",
    topic: "marks",
    keywords: ["shine", "star", "new"],
    draw: solid(
      `<path d="M64 10c4 36 18 50 54 54-36 4-50 18-54 54-4-36-18-50-54-54 36-4 50-18 54-54Z"/>`,
    ),
  },
  {
    id: "burst",
    label: "Burst",
    topic: "marks",
    keywords: ["pow", "boom", "explosion", "new"],
    draw: solid(`<path d="${star(12, 56, 38)}"/>`),
  },
  {
    id: "speech",
    label: "Speech bubble",
    topic: "bubbles",
    keywords: ["say", "talk", "text", "balloon"],
    draw: solid(`<path d="M12 16H116V84H56L32 114V84H12Z"/>`),
  },
  {
    id: "speech-round",
    label: "Round speech bubble",
    topic: "bubbles",
    keywords: ["say", "talk", "text", "balloon"],
    draw: solid(
      `<path d="M64 14C30 14 10 34 10 54c0 18 14 32 32 36l-6 26 28-22c34 0 54-18 54-40 0-20-20-40-54-40Z"/>`,
    ),
  },
  {
    id: "thought",
    label: "Thought bubble",
    topic: "bubbles",
    keywords: ["think", "idea", "cloud", "balloon"],
    draw: solid(
      `<circle cx="42" cy="46" r="26"/><circle cx="82" cy="42" r="30"/><circle cx="96" cy="66" r="20"/>` +
        `<circle cx="62" cy="70" r="24"/><circle cx="34" cy="66" r="18"/>` +
        `<circle cx="34" cy="100" r="8"/><circle cx="20" cy="116" r="5"/>`,
    ),
  },
  {
    id: "shout",
    label: "Shout bubble",
    topic: "bubbles",
    keywords: ["yell", "loud", "wow", "balloon"],
    draw: solid(`<path d="${star(14, 58, 42)}"/>`),
  },
];
