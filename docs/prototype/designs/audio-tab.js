// The inspector's Audio tab for the dark look: on/off sections, sliders and a draggable equalizer.
// Mock only: nothing here touches sound. Load after shared.js, call wireAudioTab() after boot().

const EQ_TYPES = {
  lowcut: { name: "Low cut", path: "M2 19C7 19 8 6 13 6h9" },
  lowshelf: { name: "Low shelf", path: "M2 7h6c4 0 4 10 8 10h6" },
  bell: { name: "Bell", path: "M2 17h6c2 0 2-10 4-10s2 10 4 10h6" },
  highshelf: { name: "High shelf", path: "M2 17h6c4 0 4-10 8-10h6" },
  highcut: { name: "High cut", path: "M2 6h9c5 0 6 13 11 13" },
};
const EQ_ORDER = Object.keys(EQ_TYPES);
const EQ_DEFAULTS = [
  { type: "lowcut", freq: 50, gain: 0 },
  { type: "lowshelf", freq: 120, gain: 0 },
  { type: "bell", freq: 500, gain: 0 },
  { type: "bell", freq: 1200, gain: 0 },
  { type: "bell", freq: 3500, gain: 0 },
  { type: "highcut", freq: 16000, gain: 0 },
];
const EQ_START = [{}, {}, { gain: 3.5 }, { gain: -2.5 }, { gain: 4 }, {}];
const EQ_GRAPH = { width: 240, height: 136, minHz: 20, maxHz: 20000, range: 24 };

const audioRow = ({ label, min, max, value, step = 1, format, key = false }) => `
  <div class="aprop" data-default="${value}" data-format="${format}">
    <span>${label}</span>
    <input class="range" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}"/>
    <b class="val"></b>
    ${key ? `<button class="key" title="Add keyframe" aria-label="Add ${label} keyframe"></button>` : "<i></i>"}
    <button class="row-reset" title="Reset ${label}" aria-label="Reset ${label}">${icon("reset")}</button>
  </div>`;

const audioSection = (title, body, { on = true, closed = false, id = "" } = {}) =>
  `<section class="sect ${on ? "" : "is-off"}" ${closed ? "data-closed" : ""} ${id ? `id="${id}"` : ""}><h4><input class="switch" type="checkbox" ${on ? "checked" : ""} aria-label="${title} on"/>${title}<button class="sect-reset" title="Reset ${title}" aria-label="Reset ${title}">${icon("reset")}</button></h4>${body}</section>`;

FILL.inspAudio = () =>
  audioSection("Volume", audioRow({ label: "Volume", min: -60, max: 12, step: 0.5, value: 0, format: "db", key: true })) +
  audioSection("Pan", audioRow({ label: "Pan", min: -100, max: 100, value: 0, format: "pan", key: true })) +
  audioSection("Fades", audioRow({ label: "Fade in", min: 0, max: 3, step: 0.1, value: 0.2, format: "sec" }) + audioRow({ label: "Fade out", min: 0, max: 3, step: 0.1, value: 0.2, format: "sec" })) +
  audioSection("Pitch", audioRow({ label: "Semitones", min: -24, max: 24, value: 0, format: "int" }) + audioRow({ label: "Cents", min: -100, max: 100, value: 0, format: "int" })) +
  audioSection("Speed change", audioRow({ label: "Speed", min: 25, max: 400, step: 5, value: 100, format: "pct" }), { on: false, closed: true }) +
  audioSection(
    "Equalizer",
    `<svg class="eq" id="eq-graph" viewBox="0 0 266 154" role="img" aria-label="Equalizer curve"></svg><div class="bands" id="eq-bands"></div>`,
    { id: "eq-section" },
  );

const AUDIO_FORMATS = {
  db: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`,
  pan: (v) => (v === 0 ? "C" : `${v < 0 ? "L" : "R"}${Math.abs(v)}`),
  sec: (v) => `${v.toFixed(1)}<small>s</small>`,
  int: (v) => `${v > 0 ? "+" : ""}${v}`,
  pct: (v) => `${v}<small>%</small>`,
};

function paintAudioRow(row) {
  const input = row.querySelector(".range");
  const value = Number(input.value);
  input.style.setProperty("--v", `${((value - input.min) / (input.max - input.min)) * 100}%`);
  row.querySelector(".val").innerHTML = AUDIO_FORMATS[row.dataset.format](value);
  row.classList.toggle("is-changed", value !== Number(row.dataset.default));
}

// ── Equalizer ────────────────────────────────────────────────────────
const octaves = (hz) => Math.log2(hz / EQ_GRAPH.minHz);
const SPAN = octaves(EQ_GRAPH.maxHz);
const eqX = (hz) => (octaves(hz) / SPAN) * EQ_GRAPH.width;
const eqHz = (x) => EQ_GRAPH.minHz * 2 ** ((x / EQ_GRAPH.width) * SPAN);
const eqY = (gain) => EQ_GRAPH.height / 2 - (gain / EQ_GRAPH.range) * (EQ_GRAPH.height / 2);
const eqGain = (y) => ((EQ_GRAPH.height / 2 - y) / (EQ_GRAPH.height / 2)) * EQ_GRAPH.range;
const isCut = (band) => band.type === "lowcut" || band.type === "highcut";
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const hzLabel = (hz) => (hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)}K` : `${Math.round(hz)}`);

function bandGain(band, hz) {
  const d = Math.log2(hz / band.freq);
  switch (band.type) {
    case "bell": return band.gain * Math.exp(-(d * d) / 0.8);
    case "lowshelf": return band.gain / (1 + Math.exp(d * 3));
    case "highshelf": return band.gain / (1 + Math.exp(-d * 3));
    case "lowcut": return Math.min(0, 12 * d);
    default: return Math.min(0, -12 * d);
  }
}

function wireEqualizer() {
  const graph = document.getElementById("eq-graph");
  const strip = document.getElementById("eq-bands");
  const bands = EQ_DEFAULTS.map((band, i) => ({ ...band, ...EQ_START[i], on: true }));

  const grid = [
    ...[62, 250, 1000, 4000, 16000].map((hz) => `<path class="eq-line" d="M${eqX(hz)} 0V${EQ_GRAPH.height}"/><text class="eq-label" x="${eqX(hz)}" y="150" text-anchor="middle">${hzLabel(hz)}</text>`),
    ...[24, 12, 0, -12, -24].map((g) => `<path class="eq-line ${g === 0 ? "is-zero" : ""}" d="M0 ${eqY(g)}H${EQ_GRAPH.width}"/><text class="eq-label" x="246" y="${clamp(eqY(g) + 3.5, 8, EQ_GRAPH.height)}">${g > 0 ? "+" : ""}${g}</text>`),
  ].join("");
  graph.innerHTML = `${grid}<path class="eq-fill"/><path class="eq-curve"/><g class="eq-nodes"></g>`;

  strip.innerHTML = bands
    .map(
      (band, i) => `<div class="band">
        <button class="band-on is-active" data-band="${i}" aria-pressed="true" title="Turn band ${i + 1} on or off">B${i + 1}</button>
        <button class="band-type" data-type="${i}"></button>
        <b data-freq="${i}"></b><small data-gain="${i}"></small>
      </div>`,
    )
    .join("");

  function paint() {
    const active = bands.filter((band) => band.on);
    const points = [];
    for (let x = 0; x <= EQ_GRAPH.width; x += 2) {
      const gain = active.reduce((sum, band) => sum + bandGain(band, eqHz(x)), 0);
      points.push(`${x} ${clamp(eqY(gain), 0, EQ_GRAPH.height).toFixed(1)}`);
    }
    graph.querySelector(".eq-curve").setAttribute("d", `M${points.join("L")}`);
    graph.querySelector(".eq-fill").setAttribute("d", `M0 ${eqY(0)}L${points.join("L")}L${EQ_GRAPH.width} ${eqY(0)}Z`);
    graph.querySelector(".eq-nodes").innerHTML = bands
      .map((band, i) =>
        band.on
          ? `<g class="eq-node" data-node="${i}" transform="translate(${eqX(band.freq)} ${eqY(band.gain)})"><circle r="7"/><text y="3" text-anchor="middle">${i + 1}</text></g>`
          : "",
      )
      .join("");
    bands.forEach((band, i) => {
      const onButton = strip.querySelector(`[data-band="${i}"]`);
      onButton.classList.toggle("is-active", band.on);
      onButton.setAttribute("aria-pressed", String(band.on));
      const typeButton = strip.querySelector(`[data-type="${i}"]`);
      typeButton.title = `${EQ_TYPES[band.type].name}: click to change`;
      typeButton.setAttribute("aria-label", `Band ${i + 1} shape: ${EQ_TYPES[band.type].name}`);
      typeButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${EQ_TYPES[band.type].path}"/></svg>`;
      strip.querySelector(`[data-freq="${i}"]`).textContent = hzLabel(band.freq);
      strip.querySelector(`[data-gain="${i}"]`).textContent = isCut(band) ? "–" : `${band.gain > 0 ? "+" : ""}${band.gain.toFixed(1)}`;
    });
  }

  strip.addEventListener("click", (event) => {
    const on = event.target.closest("[data-band]");
    const type = event.target.closest("[data-type]");
    if (on) bands[on.dataset.band].on = !bands[on.dataset.band].on;
    if (type) {
      const band = bands[type.dataset.type];
      band.type = EQ_ORDER[(EQ_ORDER.indexOf(band.type) + 1) % EQ_ORDER.length];
      if (isCut(band)) band.gain = 0;
    }
    paint();
  });

  let dragging = null;
  const toGraph = (event) => {
    const box = graph.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * 266, y: ((event.clientY - box.top) / box.height) * 154 };
  };
  graph.addEventListener("pointerdown", (event) => {
    const node = event.target.closest("[data-node]");
    if (!node) return;
    dragging = bands[node.dataset.node];
    graph.setPointerCapture(event.pointerId);
  });
  graph.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const { x, y } = toGraph(event);
    dragging.freq = clamp(eqHz(x), EQ_GRAPH.minHz, EQ_GRAPH.maxHz);
    if (!isCut(dragging)) dragging.gain = Math.round(clamp(eqGain(y), -EQ_GRAPH.range, EQ_GRAPH.range) * 2) / 2;
    paint();
  });
  const release = () => (dragging = null);
  graph.addEventListener("pointerup", release);
  graph.addEventListener("pointercancel", release);

  document.querySelector("#eq-section .sect-reset").addEventListener("click", () => {
    bands.forEach((band, i) => Object.assign(band, EQ_DEFAULTS[i], { on: true }));
    paint();
  });
  paint();
}

function wireAudioTab() {
  const tab = document.querySelector('[data-show="insp:audio"]');
  tab.querySelectorAll(".aprop").forEach(paintAudioRow);
  tab.addEventListener("input", (event) => {
    const row = event.target.closest(".aprop");
    if (row) paintAudioRow(row);
  });
  tab.addEventListener("change", (event) => {
    if (event.target.matches("h4 .switch")) event.target.closest(".sect").classList.toggle("is-off", !event.target.checked);
  });
  const reset = (row) => {
    row.querySelector(".range").value = row.dataset.default;
    row.querySelector(".key")?.classList.remove("is-active");
    paintAudioRow(row);
  };
  tab.addEventListener("click", (event) => {
    const key = event.target.closest(".key");
    const rowReset = event.target.closest(".row-reset");
    const sectReset = event.target.closest(".sect-reset");
    if (key) key.classList.toggle("is-active");
    if (rowReset) reset(rowReset.closest(".aprop"));
    if (sectReset) sectReset.closest(".sect").querySelectorAll(".aprop").forEach(reset);
  });
  wireEqualizer();
}
