// Shared content for the three look options. Same project in each, so only the design differs.
// Fills the [data-fill] slots, draws the timeline and wires the tabs. Tabs are the only live part.

const SCENES = [
  { id: "plaza", name: "Plaza", dur: 3.4 },
  { id: "highway", name: "Highway", dur: 3.2 },
  { id: "wheat", name: "Wheat field", dur: 2.2 },
  { id: "city", name: "Skyline", dur: 2.4 },
  { id: "plane", name: "Plane", dur: 1.6 },
  { id: "meadow", name: "Meadow", dur: 2.2 },
  { id: "tractor", name: "Tractor", dur: 3.0 },
];

const VIEW = 20; // seconds visible on the timeline
const PLAYHEAD = 4.9;
const pct = (s) => `${((s / VIEW) * 100).toFixed(3)}%`;
const clock = (s) => `0:${String(Math.floor(s)).padStart(2, "0")}.${Math.round((s % 1) * 10)}`;

const ICONS = {
  edit: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z"/><path d="m6.2 5.3 3.1 3.9M12.4 3.4l3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
  video: '<rect x="2" y="6" width="14" height="12"/><path d="m16 10 6-3v10l-6-3"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  folderOpen: '<path d="M3 19V6h6l2 2h8v3"/><path d="M3 19h16l3-8H6z"/>',
  drive: '<path d="M3 13 6 5h12l3 8v6H3z"/><path d="M3 13h18M7 16h.01"/>',
  smart: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
  grid: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  solid: '<rect x="4" y="4" width="16" height="16" fill="currentColor"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  media: '<rect x="3" y="5" width="18" height="14"/><path d="m10 9 5 3-5 3z"/>',
  text: '<path d="M5 7V4h14v3M12 4v16M9 20h6"/>',
  sticker: '<path d="M20 12a8 8 0 1 1-8-8h8z"/><path d="M9 10h.01M15 10h.01M9 15c1.5 1.3 4.5 1.3 6 0"/>',
  trans: '<rect x="3" y="6" width="8" height="12"/><rect x="13" y="6" width="8" height="12"/><path d="M9 12h6"/>',
  play: '<path d="m7 4 13 8-13 8z"/>',
  prev: '<path d="M6 5v14M19 5 9 12l10 7z"/>',
  next: '<path d="M18 5v14M5 5l10 7-10 7z"/>',
  split: '<path d="M12 3v18M5 8l3 4-3 4M19 8l-3 4 3 4"/>',
  trash: '<path d="M3 7h18M6 7v13h12V7M9 7V4h6v3"/>',
  export: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  sound: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4zM16 9a5 5 0 0 1 0 6"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
};

const icon = (name) =>
  `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
const seal = (cls = "") =>
  `<svg class="seal-use ${cls}" viewBox="0 0 120 100" aria-hidden="true"><use href="#seal"/></svg>`;

function wave(seed, bars = 150) {
  let v = seed;
  const rects = [];
  for (let i = 0; i < bars; i += 1) {
    v = (v * 9301 + 49297) % 233280;
    const beat = i % 12 < 3 ? 1 : 0.55;
    const h = Math.max(6, (v / 233280) * 100 * beat);
    rects.push(`<rect x="${i}" y="${(100 - h) / 2}" width="0.62" height="${h}"/>`);
  }
  return `<svg class="wave" viewBox="0 0 ${bars} 100" preserveAspectRatio="none" aria-hidden="true">${rects.join("")}</svg>`;
}

// ── Library tabs ─────────────────────────────────────────────────────
const FILL = {
  media: () =>
    `<div class="pane-head"><label class="search">${icon("search")}<input placeholder="Search media" aria-label="Search media"/></label>
      <button class="btn btn-primary btn-sm">${icon("plus")}Import</button></div>
     <div class="bin">${SCENES.map(
       (s) => `<figure class="bin-item ${s.id === "highway" ? "is-used" : ""}">
         <div class="thumb"><img src="footage/${s.id}.jpg" alt=""/><span class="dur">${clock(s.dur)}</span></div>
         <figcaption>${s.name}</figcaption></figure>`,
     ).join("")}</div>`,

  text: () =>
    `<div class="pane-head"><button class="btn btn-primary btn-sm btn-wide">${icon("plus")}Add text</button></div>
     <div class="presets">${[
       ["Title", "pv-title"],
       ["Caption", "pv-caption"],
       ["Lower third", "pv-lower"],
       ["Top and bottom", "pv-meme"],
       ["Outline", "pv-outline"],
       ["Quiet note", "pv-note"],
     ]
       .map(([n, c]) => `<button class="preset ${c}"><span class="preset-art">Aa</span><span class="preset-name">${n}</span></button>`)
       .join("")}</div>`,

  stickers: () =>
    `<div class="pane-head"><label class="search">${icon("search")}<input placeholder="Search stickers" aria-label="Search stickers"/></label></div>
     <h4 class="group-title">Foca Watona</h4>
     <div class="stickers">${[
       ["Stare", ""],
       ["Squished", "st-squish"],
       ["Stretched", "st-tall"],
       ["Tilted", "st-tilt"],
       ["Sideways", "st-side"],
       ["Upside down", "st-flip"],
     ]
       .map(([n, c]) => `<button class="sticker" title="${n}">${seal(c)}<span>${n}</span></button>`)
       .join("")}</div>`,

  transitions: () =>
    `<div class="trans">${["Cross dissolve", "Dissolve", "Fade", "Left to right", "Glare", "Glitch", "Woosh"]
      .map(
        (n, i) => `<button class="tr-card ${i === 0 ? "is-used" : ""}"><span class="tr-art tr-${i}">
          <img src="footage/highway.jpg" alt=""/><img src="footage/wheat.jpg" alt=""/></span><span>${n}</span></button>`,
      )
      .join("")}</div>`,

  // ── Inspector tabs ─────────────────────────────────────────────────
  inspVideo: () =>
    section("Transform", [
      num("Position X", "0", "px"),
      num("Position Y", "-48", "px", true),
      slider("Scale", 112, 112, "%", 200),
      slider("Rotation", 50, 0, "°", 100),
      slider("Opacity", 100, 100, "%", 100),
    ]) +
    section("Fit", [
      `<div class="seg" role="group" aria-label="Fit"><button class="is-active">Fill</button><button>Fit</button><button>Stretch</button></div>`,
    ]),

  inspAudio: () =>
    section("Sound", [slider("Volume", 72, 0, "dB", 100), slider("Fade in", 8, 0.2, "s", 100), slider("Fade out", 8, 0.2, "s", 100)]),

  inspTransition: () =>
    section("Into Wheat field", [
      `<div class="kv"><span>Preset</span><b>Cross dissolve</b></div>`,
      slider("Duration", 24, 0.5, "s", 100),
      `<div class="kv"><span>Align</span><b>Centered on the cut</b></div>`,
    ]),

  inspFile: () =>
    section("Highway.mp4", [
      `<div class="kv"><span>Size</span><b>1920 × 1080</b></div>`,
      `<div class="kv"><span>Frame rate</span><b>29.97 fps</b></div>`,
      `<div class="kv"><span>Codec</span><b>H.264 / AAC</b></div>`,
      `<div class="kv"><span>Length</span><b>0:12.6</b></div>`,
      `<div class="kv"><span>Proxy</span><b>Ready</b></div>`,
    ]),

  // ── Pages ──────────────────────────────────────────────────────────
  library: () =>
    `<div class="lib-grid">${SCENES.map(
      (s) => `<figure class="lib-card"><div class="thumb"><img src="footage/${s.id}.jpg" alt=""/><span class="dur">${clock(s.dur)}</span></div>
        <figcaption><b>${s.name}</b><span>1920 × 1080 · 29.97 fps</span></figcaption></figure>`,
    ).join("")}</div>`,

  queue: () =>
    `<ul class="queue">${[
      ["Main", "1920 × 1080 · H.264 · 18 s", "Done", 100, "is-done"],
      ["Vertical cut", "1080 × 1920 · H.264 · 18 s", "Exporting · 64%", 64, "is-running"],
      ["Highway only", "1920 × 1080 · ProRes · 3 s", "Waiting", 0, ""],
    ]
      .map(
        ([n, m, st, p, c]) => `<li class="job ${c}"><img src="footage/${n === "Vertical cut" ? "meadow" : n === "Main" ? "plaza" : "highway"}.jpg" alt=""/>
          <div class="job-text"><b>${n}</b><span>${m}</span><div class="bar"><i style="width:${p}%"></i></div></div>
          <span class="job-state">${st}</span></li>`,
      )
      .join("")}</ul>`,
};

function section(title, rows) {
  return `<section class="sect"><h4>${title}<button class="sect-reset" title="Reset ${title}">${icon("reset")}</button></h4>${rows.join("")}</section>`;
}
function num(label, value, unit, changed) {
  return `<div class="prop ${changed ? "is-changed" : ""}"><span>${label}</span><b class="val">${value}<small>${unit}</small></b></div>`;
}
function slider(label, fill, value, unit, max) {
  return `<div class="prop has-slider"><span>${label}</span><div class="slider"><i style="width:${(fill / max) * 100}%"></i></div><b class="val">${value}<small>${unit}</small></b></div>`;
}

// ── Timeline ─────────────────────────────────────────────────────────
function buildClips() {
  let at = 0;
  return SCENES.map((s, i) => {
    const clip = { ...s, kind: "video", start: at, n: i + 1 };
    at += s.dur;
    return clip;
  });
}

function renderTimeline(root, opts = {}) {
  const video = buildClips();
  const decorate = opts.clip ?? (() => "");
  const clipHtml = (c) => {
    const film = c.kind === "video" ? `<span class="film" style="background-image:url(footage/${c.id}.jpg)"></span>` : "";
    const body = c.kind === "audio" ? wave(c.seed) : "";
    const sel = c.id === "highway" ? " is-sel" : "";
    return `<div class="clip k-${c.kind}${sel}" style="left:${pct(c.start)};width:${pct(c.dur)}">${film}${body}${decorate(c)}<span class="clip-name">${c.name}</span></div>`;
  };

  const lanes = [
    { id: "T1", icon: "text", clips: [
        { kind: "text", name: "they have left the beach", start: 3.8, dur: 2.8 },
        { kind: "text", name: "no one is stopping them", start: 8.4, dur: 3.2 },
      ] },
    { id: "S1", icon: "sticker", clips: [{ kind: "sticker", name: "Foca Watona · Stare", start: 13.4, dur: 2.4 }] },
    { id: "V1", icon: "media", main: true, clips: video },
    { id: "A1", icon: "sound", clips: [{ kind: "audio", name: "Seal slide", start: 0, dur: 18, seed: 7 }] },
  ];

  const cuts = [
    { at: video[2].start, on: true },
    { at: video[5].start },
  ];

  const ticks = [];
  for (let s = 0; s <= VIEW; s += 1) {
    ticks.push(`<i class="tick ${s % 5 === 0 ? "is-major" : ""}" style="left:${pct(s)}">${s % 5 === 0 ? `<b>${clock(s).slice(0, 4)}</b>` : ""}</i>`);
  }

  root.innerHTML = `
    <div class="tl-row tl-ruler"><div class="tl-corner"></div><div class="ruler">${ticks.join("")}</div></div>
    ${lanes
      .map(
        (l) => `<div class="tl-row ${l.main ? "is-main" : ""}"><div class="tl-head"><span class="tl-id">${icon(l.icon)}${l.id}</span>
          <span class="tl-btns">${l.id === "A1" ? icon("mute") : icon("eye")}${icon("lock")}</span></div>
          <div class="lane">${l.clips.map(clipHtml).join("")}${l.main ? cuts.map((c) => `<span class="cut ${c.on ? "is-on" : ""}" style="left:${pct(c.at)}"></span>`).join("") : ""}</div></div>`,
      )
      .join("")}
    <div class="playhead" style="--at:${PLAYHEAD / VIEW}">${opts.playhead ?? ""}</div>`;
}

// ── Boot ─────────────────────────────────────────────────────────────
function activate(group, id) {
  document.querySelectorAll(`[data-go^="${group}:"]`).forEach((b) => {
    const on = b.dataset.go === `${group}:${id}`;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-selected", String(on));
  });
  document.querySelectorAll(`[data-show^="${group}:"]`).forEach((p) => {
    p.hidden = p.dataset.show !== `${group}:${id}`;
  });
}

function boot(opts) {
  document.querySelectorAll("[data-i]").forEach((el) => {
    el.innerHTML = icon(el.dataset.i) + el.innerHTML;
  });
  document.querySelectorAll("[data-fill]").forEach((el) => {
    el.innerHTML = FILL[el.dataset.fill]();
  });
  renderTimeline(document.getElementById("timeline"), opts);

  const firsts = new Map();
  document.querySelectorAll("[data-go]").forEach((b) => {
    const [group, id] = b.dataset.go.split(":");
    if (!firsts.has(group)) firsts.set(group, id);
    b.setAttribute("role", "tab");
    b.addEventListener("click", () => activate(group, id));
  });
  firsts.forEach((id, group) => activate(group, id));

  // `#page:export,tool:text` opens straight on those tabs.
  location.hash
    .slice(1)
    .split(",")
    .filter(Boolean)
    .forEach((pair) => {
      const [group, id] = pair.split(":");
      activate(group, id);
    });
}
