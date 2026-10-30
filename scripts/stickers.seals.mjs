// Writes the animated seals of the Cloudy Seal pack as Lottie files (and a still of each), from
// the drawings and CSS keyframes of Cloudy Canvas's brand seals. Each part is an embedded SVG on a
// Lottie layer, so the art stays exact, and motion is sampled from the keyframes. Run it only to
// change them (`node scripts/stickers.seals.mjs`); what it writes is committed.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "src/modules/sticker/packs/seal/anim";
const FPS = 30;
/** Motion is sampled every this many frames; playback interpolates between samples. */
const STEP = 2;
const SIDE = 512;
const INK = 1.6;

const C = {
  s50: "#fafbfc",
  s200: "#dfe3e8",
  s300: "#c3cad2",
  s400: "#a3abb5",
  s500: "#7f8894",
  s700: "#4a5260",
  s900: "#2a2f37",
  b300: "#f3a796",
  b400: "#f0a48e",
  b500: "#e9826d",
  n100: "#f7efd9",
  n300: "#f2dc8e",
  n400: "#ecc65c",
  n500: "#e3b53f",
  n600: "#c9962f",
  i50: "#f0f7fd",
  i300: "#b4d3ee",
  i400: "#8dbbe6",
  i500: "#5fa0dc",
  l500: "#a389d9",
};

const FUR =
  `<linearGradient id="fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.s300}"/>` +
  `<stop offset="0.8" stop-color="#eef0f3"/></linearGradient>`;

function attrs({ fill = "none", stroke, sw, opacity, rot }, cx, cy) {
  return [
    `fill="${fill}"`,
    stroke && `stroke="${stroke}"`,
    sw && `stroke-width="${sw}"`,
    opacity !== undefined && `opacity="${opacity}"`,
    rot && `transform="rotate(${rot} ${cx} ${cy})"`,
  ]
    .filter(Boolean)
    .join(" ");
}
const ell = (cx, cy, rx, ry, o) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${attrs(o, cx, cy)}/>`;
const path = (d, o) => `<path d="${d}" ${attrs(o)}/>`;
const inked = (fill, extra = {}) => ({ fill, stroke: C.s900, sw: INK, ...extra });
const spots = (list) => list.map(([x, y, rx, ry]) => ell(x, y, rx, ry, { fill: C.s400 })).join("");
const MUZZLE =
  "c-1-1.6-5.6-1.6-6 1.4-.3 2.4 2.6 3.4 4.4 2.6.8-.3 1.3-.8 1.6-1.3.3.5.8 1 1.6 1.3 1.8.8 4.7-.2 4.4-2.6-.4-3-5-3-6-1.4z";

const EASE = {
  "ease-in-out": [0.42, 0, 0.58, 1],
  "ease-in": [0.42, 0, 1, 1],
  linear: [0, 0, 1, 1],
};

/** CSS `cubic-bezier` at progress `x`. */
function bezier([x1, y1, x2, y2], x) {
  const at = (a, b, t) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (at(x1, x2, mid) < x) low = mid;
    else high = mid;
  }
  return at(y1, y2, (low + high) / 2);
}

/** CSS-style keyframes. `stops`: `[percent, { x, y, sx, sy, r, o }]`, `alternate` as in CSS. */
function motion(duration, stops, { delay = 0, ease = "ease-in-out", alternate = false } = {}) {
  return { duration, stops, delay, ease, alternate };
}

const IDENTITY = { x: 0, y: 0, sx: 1, sy: 1, r: 0 };

/** One value of a motion at time `t`. Opacity interpolates only between stops that name it. */
function sample({ duration, stops, delay, ease, alternate }, t, key) {
  const span = alternate ? duration * 2 : duration;
  let phase = (((t - delay) % span) + span) % span;
  if (alternate && phase > duration) phase = span - phase;
  const percent = (phase / duration) * 100;
  const known = key === "o" ? stops.filter(([, v]) => v.o !== undefined) : stops;
  if (known.length === 0) return key === "o" ? 1 : IDENTITY[key];
  const value = (stop) => stop[1][key] ?? IDENTITY[key];
  let a = known[0];
  let b = known[known.length - 1];
  for (let i = 0; i + 1 < known.length; i++) {
    if (percent >= known[i][0] && percent <= known[i + 1][0]) {
      a = known[i];
      b = known[i + 1];
      break;
    }
  }
  const length = b[0] - a[0];
  const eased = length > 0 ? bezier(EASE[ease], (percent - a[0]) / length) : 0;
  return value(a) + (value(b) - value(a)) * eased;
}

const rounded = (n) => Math.round(n * 1000) / 1000;

/** A Lottie property, or a static one when it doesn't change. */
function animated(values) {
  const same = values.every((v) => v.every((n, i) => n === values[0][i]));
  if (same) return { a: 0, k: values[0] };
  const k = values.map((s, i) => ({
    t: i * STEP,
    s,
    i: { x: [1], y: [1] },
    o: { x: [0], y: [0] },
  }));
  return { a: 1, k };
}

const still = (markup) => ({ markup });
/** A part moving around `origin`, with its parts inside. */
const moving = (animation, origin, ...children) => ({ animation, origin, children });

function svgOf(scene, markup) {
  const [x, y, w, h] = scene.view;
  const scale = SIDE / Math.max(w, h);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" ` +
    `width="${Math.round(w * scale)}" height="${Math.round(h * scale)}" ` +
    `stroke-linecap="round" stroke-linejoin="round"><defs>${FUR}</defs>${markup}</svg>`
  );
}

/** The whole scene at time `t`, as one drawing. */
function stillOf(scene, nodes, t) {
  return nodes
    .map((node) => {
      if (node.markup) return node.markup;
      const v = (key) => sample(node.animation, t, key);
      const [ox, oy] = node.origin;
      const transform =
        `translate(${v("x") + ox} ${v("y") + oy}) rotate(${v("r")}) ` +
        `scale(${v("sx")} ${v("sy")}) translate(${-ox} ${-oy})`;
      return `<g transform="${transform}" opacity="${v("o")}">${stillOf(scene, node.children, t)}</g>`;
    })
    .join("");
}

function buildLottie(scene) {
  const [viewX, viewY, viewW, viewH] = scene.view;
  const scale = SIDE / Math.max(viewW, viewH);
  const w = Math.round(viewW * scale);
  const h = Math.round(viewH * scale);
  const frames = Math.round(scene.loop * FPS);
  const times = Array.from({ length: Math.ceil(frames / STEP) + 1 }, (_, i) => (i * STEP) / FPS);
  const assets = [];
  const layers = [];
  let next = 0;

  const transform = (node) => {
    if (!node) {
      return {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [0, 0, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      };
    }
    const [ox, oy] = node.origin;
    const anchor = [(ox - viewX) * scale, (oy - viewY) * scale, 0].map(rounded);
    const series = (read) => animated(times.map((t) => read(t).map(rounded)));
    const m = node.animation;
    const single = (p) => (p.a === 0 ? { a: 0, k: p.k[0] } : p);
    return {
      o: single(series((t) => [sample(m, t, "o") * 100])),
      r: single(series((t) => [sample(m, t, "r")])),
      p: series((t) => [
        anchor[0] + sample(m, t, "x") * scale,
        anchor[1] + sample(m, t, "y") * scale,
        0,
      ]),
      a: { a: 0, k: anchor },
      s: series((t) => [sample(m, t, "sx") * 100, sample(m, t, "sy") * 100, 100]),
    };
  };

  const image = (markup, node, parent) => {
    const id = `part${assets.length}`;
    const data = Buffer.from(svgOf(scene, markup)).toString("base64");
    assets.push({ id, w, h, u: "", p: `data:image/svg+xml;base64,${data}`, e: 1 });
    const ind = ++next;
    layers.push({
      ty: 2,
      ind,
      refId: id,
      ks: transform(node),
      ip: 0,
      op: frames,
      st: 0,
      bm: 0,
      ...(parent && { parent }),
    });
  };

  const walk = (nodes, parent) => {
    for (const node of nodes) {
      if (node.markup) {
        image(node.markup, null, parent);
      } else if (node.children.length === 1 && node.children[0].markup) {
        image(node.children[0].markup, node, parent);
      } else {
        const ind = ++next;
        layers.push({
          ty: 3,
          ind,
          ks: transform(node),
          ip: 0,
          op: frames,
          st: 0,
          ...(parent && { parent }),
        });
        walk(node.children, ind);
      }
    }
  };
  walk(scene.nodes);

  return {
    v: "5.7.0",
    fr: FPS,
    ip: 0,
    op: frames,
    w,
    h,
    nm: scene.id,
    ddd: 0,
    assets,
    // Lottie draws its first layer on top; the parts are listed bottom first, as in the SVG.
    layers: layers.reverse(),
  };
}

const hop = motion(0.9, [
  [0, { sx: 1.12, sy: 0.86 }],
  [15, { sx: 0.92, sy: 1.1 }],
  [50, { y: -14, r: -4 }],
  [80, { y: -2, sx: 0.96, sy: 1.05 }],
  [100, { sx: 1.12, sy: 0.86 }],
]);
const shadow = motion(0.9, [
  [0, { o: 1 }],
  [50, { sx: 0.55, sy: 0.55, o: 0.45 }],
  [100, { o: 1 }],
]);
const shadowEllipse = ell(32, 58, 15, 2.5, { fill: C.s900, opacity: 0.18 });
const HOP_SPOTS = [
  [24, 21, 1.6, 1.1],
  [31, 18, 1.2, 0.8],
  [38.5, 19.5, 1.8, 1.2],
  [45, 25, 1.3, 1],
  [19, 27, 1.2, 0.9],
  [42, 39, 1.4, 1],
  [22, 40, 1, 0.8],
];
const tails =
  ell(26, 52, 5, 2.4, inked(C.s300, { rot: -20 })) +
  ell(38, 52, 5, 2.4, inked(C.s300, { rot: 20 }));
const body = ell(32, 33, 20, 18, inked("url(#fur)")) + spots(HOP_SPOTS);
const muzzle =
  path(`M32 31.2${MUZZLE}`, inked(C.s50, { sw: INK * 0.8 })) +
  ell(32, 30.9, 1.7, 1.15, { fill: C.s900 });

const hopping = {
  id: "hopping",
  view: [-8, -10, 80, 76],
  loop: 0.9,
  nodes: [
    moving(shadow, [32, 58], still(shadowEllipse)),
    moving(
      hop,
      [32, 57],
      still(
        tails +
          body +
          ell(15, 42, 5.5, 2.6, inked(C.s200, { rot: -35 })) +
          ell(49, 42, 5.5, 2.6, inked(C.s200, { rot: 35 })) +
          ell(19.5, 31, 3, 1.8, { fill: C.b300, opacity: 0.8 }) +
          ell(44.5, 31, 3, 1.8, { fill: C.b300, opacity: 0.8 }) +
          path("M21.5 27.5q3-3 6 0M36.5 27.5q3-3 6 0", { stroke: C.s900, sw: INK }) +
          muzzle,
      ),
    ),
  ],
};

const sparkleShape = (x, y, r, fill) => {
  const k = r * 0.3;
  return path(
    `M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z`,
    { fill },
  );
};
const sparkling = (delay) =>
  motion(
    1.2,
    [
      [0, { sx: 0.4, sy: 0.4, o: 0.3 }],
      [50, { sx: 1.15, sy: 1.15, o: 1 }],
      [100, { sx: 0.4, sy: 0.4, o: 0.3 }],
    ],
    { delay },
  );
const waving = (delay) =>
  motion(
    0.45,
    [
      [0, { r: -14 }],
      [100, { r: 14 }],
    ],
    { delay, alternate: true },
  );

const celebrating = {
  id: "celebrating",
  view: [-8, -10, 80, 76],
  loop: 3.6,
  nodes: [
    moving(sparkling(0), [2, 6], still(sparkleShape(2, 6, 3.5, C.n400))),
    moving(sparkling(0.3), [62, 2], still(sparkleShape(62, 2, 3, C.i400))),
    moving(sparkling(0.6), [66, 30], still(sparkleShape(66, 30, 2.4, C.b400))),
    moving(sparkling(0.9), [-2, 34], still(sparkleShape(-2, 34, 2.2, C.i400))),
    moving(shadow, [32, 58], still(shadowEllipse)),
    moving(
      hop,
      [32, 57],
      still(tails),
      moving(waving(0), [15, 32], still(ell(11, 27, 6, 2.7, inked(C.s200, { rot: -55 })))),
      moving(waving(0.22), [49, 32], still(ell(53, 27, 6, 2.7, inked(C.s200, { rot: 55 })))),
      still(
        body +
          ell(19.5, 31, 3.2, 2, { fill: C.b300, opacity: 0.9 }) +
          ell(44.5, 31, 3.2, 2, { fill: C.b300, opacity: 0.9 }) +
          path("M21.5 27.5q3-3.4 6 0M36.5 27.5q3-3.4 6 0", { stroke: C.s900, sw: INK }) +
          muzzle +
          path("M29.6 35.6q2.4 3.4 4.8 0z", inked(C.b500, { sw: INK * 0.7 })),
      ),
    ),
  ],
};

const patMarks = (delay) =>
  motion(
    1.2,
    [
      [0, { o: 0 }],
      [30, { o: 0 }],
      [38, { o: 1 }],
      [60, { o: 0 }],
      [100, { o: 0 }],
    ],
    { delay, ease: "linear" },
  );
const pat = (swing, delay) =>
  motion(
    1.2,
    [
      [0, { r: swing }],
      [35, { r: 0 }],
      [45, { r: swing * 0.3 }],
      [55, { r: swing }],
      [100, { r: swing }],
    ],
    { delay },
  );
const PAT_BODY =
  "M32 8C40 8 45 14 45 21C45 26 43.5 28.5 44.5 31.5C48.5 36.5 49.5 44 47.5 50C45.5 56 39.5 58 32 58C24.5 58 18.5 56 16.5 50C14.5 44 15.5 36.5 19.5 31.5C20.5 28.5 19 26 19 21C19 14 24 8 32 8Z";
const PAT_SPOTS = [
  [24, 13.5, 1.3, 0.9],
  [39, 12.5, 1.1, 0.8],
  [19, 34, 1.2, 0.9],
  [45, 37, 1.4, 1],
  [20.5, 49, 1, 0.8],
  [43, 51, 1.2, 0.9],
];

const patting = {
  id: "patting",
  view: [0, 0, 64, 64],
  loop: 1.2,
  nodes: [
    still(ell(32, 59, 15, 2.5, { fill: C.s900, opacity: 0.15 })),
    moving(
      patMarks(0),
      [12, 45],
      still(
        path("M12.5 40.5l-3-1.5M11.5 45h-3.5M12.5 49.5l-3 1.5", { stroke: C.s500, sw: INK * 0.8 }),
      ),
    ),
    moving(
      patMarks(-0.6),
      [52, 45],
      still(
        path("M51.5 40.5l3-1.5M52.5 45h3.5M51.5 49.5l3 1.5", { stroke: C.s500, sw: INK * 0.8 }),
      ),
    ),
    moving(
      motion(1.2, [
        [0, { r: 0 }],
        [35, { r: -2.5 }],
        [85, { r: 2.5 }],
        [100, { r: 0 }],
      ]),
      [32, 58],
      still(
        ell(24.5, 56.5, 5, 2.3, inked(C.s300, { rot: -15 })) +
          ell(39.5, 56.5, 5, 2.3, inked(C.s300, { rot: 15 })) +
          path(PAT_BODY, inked("url(#fur)")) +
          spots(PAT_SPOTS),
      ),
      moving(
        motion(
          0.6,
          [
            [0, {}],
            [60, {}],
            [70, { sx: 1.07, sy: 0.93 }],
            [82, { sx: 0.98, sy: 1.02 }],
            [100, {}],
          ],
          { ease: "linear" },
        ),
        [32, 54],
        still(ell(32, 45, 9.5, 9, { fill: C.s50, opacity: 0.9 })),
      ),
      still(
        ell(23.5, 23.5, 2.8, 1.7, { fill: C.b300, opacity: 0.8 }) +
          ell(40.5, 23.5, 2.8, 1.7, { fill: C.b300, opacity: 0.8 }) +
          path("M24.5 19.5q2.7-2.7 5.4 0M34.1 19.5q2.7-2.7 5.4 0", { stroke: C.s900, sw: INK }) +
          `<g transform="translate(0 -8)">${muzzle}</g>`,
      ),
      moving(pat(38, 0), [20, 36], still(ell(25, 43, 6.5, 2.7, inked(C.s200, { rot: 50 })))),
      moving(pat(-38, -0.6), [44, 36], still(ell(39, 43, 6.5, 2.7, inked(C.s200, { rot: -50 })))),
    ),
  ],
};

const twinkle = (delay) =>
  motion(
    2.4,
    [
      [0, {}],
      [70, {}],
      [80, { sx: 1.35, sy: 1.35 }],
      [100, {}],
    ],
    { delay },
  );
const PAINTS = [
  [57.5, 45.5, C.b500],
  [60.5, 41.8, C.n500],
  [64.8, 41.6, C.i500],
  [58.6, 49.6, C.l500],
  [62.8, 50.6, C.s700],
];
const PAINT_SPOTS = [
  [22, 36, 1.8, 1.2],
  [30, 30, 1.3, 0.9],
  [37, 40, 2, 1.3],
  [27, 44, 1.4, 1],
  [45, 31, 1.4, 1],
  [50, 42, 1.6, 1.1],
  [18, 44, 1.1, 0.8],
];

const painting = {
  id: "painting",
  view: [-2, -2, 100, 68],
  loop: 9.6,
  nodes: [
    still(ell(46, 59.5, 36, 2.6, { fill: C.s900, opacity: 0.12 })),
    moving(
      motion(2.4, [
        [0, { r: 0 }],
        [50, { r: 7 }],
        [100, { r: 0 }],
      ]),
      [14, 48],
      still(
        ell(9, 44, 6.5, 2.6, inked(C.s300, { rot: -25 })) +
          ell(9.5, 50, 6, 2.4, inked(C.s300, { rot: 12 })),
      ),
    ),
    moving(
      motion(3.2, [
        [0, {}],
        [50, { sx: 1.015, sy: 0.97 }],
        [100, {}],
      ]),
      [46, 58],
      moving(
        motion(1.6, [
          [0, { r: -8 }],
          [50, { r: 10 }],
          [100, { r: -8 }],
        ]),
        [70, 36],
        still(
          path("M70 36L83 8", { stroke: C.n600, sw: 2.4 }) +
            path("M82.4 9.5l2.2-4.6", { stroke: C.s400, sw: 2.8 }) +
            path(
              "M84.2 5.2c.6-1.8 1.8-3 2.6-3.7-.1 1.6-.6 3.4-1.6 4.6z",
              inked(C.i500, { sw: INK * 0.6 }),
            ),
        ),
      ),
      still(
        path(
          "M14 46c0-12 14-20 32-20 6 0 10-2 14-6 4-5 10-7 15-5 6 2 9 8 8 15-1 8-6 12-12 14 2 3 2 6-1 8H22c-5 0-8-3-8-6z",
          inked("url(#fur)"),
        ) +
          path("M24 56c10 2 30 2 40 0", { stroke: C.s300, sw: INK }) +
          spots(PAINT_SPOTS) +
          ell(69, 29, 2.6, 1.6, { fill: C.b300, opacity: 0.8 }) +
          ell(84, 28, 2.4, 1.5, { fill: C.b300, opacity: 0.8 }) +
          path("M70.5 24.5q2.4-2.4 4.8 0M79 24q2.4-2.4 4.8 0", { stroke: C.s900, sw: INK }) +
          path(
            "M77.3 28.4c-.9-1.4-5-1.4-5.4 1.2-.3 2.1 2.3 3 3.9 2.3.7-.3 1.1-.7 1.4-1.1.3.4.7.8 1.4 1.1 1.6.7 4.2-.2 3.9-2.3-.4-2.6-4.5-2.6-5.4-1.2z",
            inked(C.s50, { sw: INK * 0.8 }),
          ) +
          ell(77.3, 28.1, 1.5, 1, { fill: C.s900 }) +
          path("M64 17.5c1-6 12-8.5 20-5.5 3 1.2 3 4-.2 4.6-6 1.2-14 2.2-19.8.9z", inked(C.s900)) +
          path("M74 11.6l.8-2.4", { stroke: C.s900, sw: 2.2 }) +
          path(
            "M54 46c0-5 5-8 10-7 5 1 7 6 4 10-1.6 2-3.6 1.6-5.2 2.6-2 1.4-4.2 1.4-6 .2-2.2-1.4-2.8-3.6-2.8-5.8z",
            inked(C.n100),
          ) +
          ell(66.5, 47.5, 1.6, 1.2, { fill: C.n300 }),
      ),
      ...PAINTS.map(([cx, cy, fill], i) =>
        moving(twinkle(i * 0.25), [cx, cy], still(ell(cx, cy, 1.5, 1.5, { fill }))),
      ),
      still(ell(66, 53, 4.5, 2.2, inked(C.s200, { rot: -20 }))),
    ),
  ],
};

const FLOE = 1.62;
/** A point of the seal's drawing in the scene. */
const inScene = (x, y) => [108 + x * FLOE, 46 + y * FLOE];
const onSeal = (markup) => `<g transform="translate(108 46) scale(${FLOE})">${markup}</g>`;
const ADRIFT_SPOTS = HOP_SPOTS.map(([x, y, rx, ry]) => [x, y + 6, rx, ry]);
const SWIRL = "a2.6 2.6 0 1 1 -2.6 -2.6 a1.6 1.6 0 1 1 -1.6 1.6 a0.6 0.6 0 1 1 0.6 0.6";
const star = (x, y, r) =>
  `M${x} ${y}l${r * 0.4} ${r * 0.84} ${r * 0.92} ${r * 0.12} ${-r * 0.68} ${r * 0.64} ${r * 0.16} ${r * 0.92} ${-r * 0.8} ${-r * 0.44} ${-r * 0.8} ${r * 0.44} ${r * 0.16} ${-r * 0.92} ${-r * 0.68} ${-r * 0.64} ${r * 0.92} ${-r * 0.12}z`;
const dizzy = motion(
  2.4,
  [
    [0, { r: 0 }],
    [100, { r: 360 }],
  ],
  { ease: "linear" },
);
const flap = (swing) =>
  motion(1.6, [
    [0, { r: 0 }],
    [50, { r: swing }],
    [100, { r: 0 }],
  ]);
const ICE = { fill: C.i50, stroke: C.i300, sw: 1.5 };

const adrift = {
  id: "adrift",
  view: [70, 14, 224, 170],
  loop: 9.6,
  nodes: [
    moving(
      motion(4.8, [
        [0, { r: 6 }],
        [50, { x: 8, y: 4, r: -3 }],
        [100, { r: 6 }],
      ]),
      [262, 162],
      still(
        path("M244 160 L252 150 L276 152 L282 162 L262 170 Z", ICE) +
          path("M252 150 L258 160 L262 170", { stroke: C.i300, sw: 1, opacity: 0.7 }),
      ),
    ),
    moving(
      motion(3.2, [
        [0, { r: -2 }],
        [50, { y: 5, r: 2 }],
        [100, { r: -2 }],
      ]),
      [160, 150],
      still(
        path("M82 160 L92 146 L226 144 L234 154 L222 168 L96 170 Z", ICE) +
          path("M226 144 L214 152 L222 158 L210 166", { stroke: C.i300, sw: 1.5 }) +
          path("M110 151 L150 150", { stroke: C.i300, sw: 1.5, opacity: 0.6 }) +
          ell(160, 148, 34, 4, { fill: C.s900, opacity: 0.14 }) +
          onSeal(
            ell(26, 58, 5, 2.4, inked(C.s300, { rot: -20 })) +
              ell(38, 58, 5, 2.4, inked(C.s300, { rot: 20 })) +
              ell(32, 39, 20, 18, inked("url(#fur)")) +
              spots(ADRIFT_SPOTS),
          ),
      ),
      moving(
        flap(-14),
        inScene(20.5, 48),
        still(onSeal(ell(15, 48, 5.5, 2.6, inked(C.s200, { rot: -35 })))),
      ),
      moving(
        flap(14),
        inScene(43.5, 48),
        still(onSeal(ell(49, 48, 5.5, 2.6, inked(C.s200, { rot: 35 })))),
      ),
      still(
        onSeal(
          ell(19.5, 37, 3, 1.8, { fill: C.b300, opacity: 0.8 }) +
            ell(44.5, 37, 3, 1.8, { fill: C.b300, opacity: 0.8 }),
        ),
      ),
      moving(
        dizzy,
        inScene(22.6, 32.4),
        still(onSeal(path(`M25 32.5 ${SWIRL}`, { stroke: C.s900, sw: 1.2 }))),
      ),
      moving(
        dizzy,
        inScene(39.8, 32.4),
        still(onSeal(path(`M42.2 32.5 ${SWIRL}`, { stroke: C.s900, sw: 1.2 }))),
      ),
      still(
        onSeal(
          path(`M32 37.2${MUZZLE}`, inked(C.s50, { sw: INK * 0.8 })) +
            ell(32, 36.9, 1.7, 1.15, { fill: C.s900 }) +
            path("M29.5 43.6q1.25 -1 2.5 0t2.5 0", { stroke: C.s900, sw: 1 }),
        ),
      ),
      moving(
        motion(
          3.2,
          [
            [0, { y: -4 * FLOE, o: 0 }],
            [55, { y: -4 * FLOE, o: 0 }],
            [65, { y: -1 * FLOE, o: 1 }],
            [100, { y: 10 * FLOE, o: 0 }],
          ],
          { ease: "ease-in" },
        ),
        inScene(50, 26),
        still(onSeal(path("M50 24q2 3 0 4.4q-2 -1.4 0 -4.4z", inked(C.i300, { sw: 0.8 })))),
      ),
      moving(
        motion(
          3.2,
          [
            [0, { r: 0 }],
            [100, { r: 360 }],
          ],
          { ease: "linear" },
        ),
        [160, 62],
        still(
          `<g stroke-width="1.1">` +
            path(star(160, 34, 5), { fill: C.b300, stroke: C.s900 }) +
            path(star(196, 70, 3.7), { fill: C.i300, stroke: C.s900 }) +
            path(star(124, 74, 3.3), { fill: C.b300, stroke: C.s900 }) +
            `</g>`,
        ),
      ),
    ),
  ],
};

await mkdir(OUT, { recursive: true });
for (const scene of [hopping, celebrating, patting, painting, adrift]) {
  const lottie = JSON.stringify(buildLottie(scene));
  await writeFile(join(OUT, `${scene.id}.json`), lottie);
  await writeFile(
    join(OUT, `${scene.id}.svg`),
    svgOf(scene, stillOf(scene, scene.nodes, scene.loop * 0.5)),
  );
  console.log(
    scene.id,
    `${(lottie.length / 1024).toFixed(0)} KB`,
    `aspect ${scene.view[2] / scene.view[3]}`,
  );
}
