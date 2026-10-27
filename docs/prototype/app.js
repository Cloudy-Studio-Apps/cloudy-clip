// Cloudy Clip prototype: just enough behavior to feel the layout. Not product code.

const stage = document.getElementById("stage");
const frame = document.getElementById("frame");

// ── Fit the frame to the stage for the current aspect ratio ──────────
function fitFrame() {
  const [w, h] = frame.dataset.aspect.split(":").map(Number);
  const pad = 40;
  const maxW = stage.clientWidth - pad;
  const maxH = stage.clientHeight - pad;
  const scale = Math.min(maxW / w, maxH / h);
  frame.style.width = `${Math.floor(w * scale)}px`;
  frame.style.height = `${Math.floor(h * scale)}px`;
}

new ResizeObserver(fitFrame).observe(stage);

// ── Aspect ratio switcher ────────────────────────────────────────────
document.getElementById("aspect").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-aspect]");
  if (!button) return;
  for (const b of event.currentTarget.children) b.classList.toggle("is-active", b === button);
  frame.dataset.aspect = button.dataset.aspect;
  fitFrame();
});

// ── Safe zones toggle ────────────────────────────────────────────────
const szToggle = document.getElementById("sz-toggle");
szToggle.addEventListener("click", () => {
  const on = szToggle.classList.toggle("is-on");
  document.getElementById("safe-zones").classList.toggle("is-hidden", !on);
});

// ── Theme toggle ─────────────────────────────────────────────────────
const THEME_KEY = "cloudy-clip-prototype:theme";
try {
  document.documentElement.dataset.theme = localStorage.getItem(THEME_KEY) ?? "dark";
} catch {
  // dark by default
}
document.getElementById("theme-toggle").addEventListener("click", () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, root.dataset.theme);
  } catch {
    // not remembered
  }
});

// ── Left panel: tool rail tabs ───────────────────────────────────────
document.getElementById("rail").addEventListener("click", (event) => {
  const tab = event.target.closest(".rail-tab");
  if (!tab) return;
  for (const t of document.querySelectorAll(".rail-tab")) t.classList.toggle("is-active", t === tab);
  for (const pane of document.querySelectorAll(".tab-pane")) {
    pane.classList.toggle("is-active", pane.dataset.pane === tab.dataset.tab);
  }
});

// Chips: single choice within a group
for (const group of document.querySelectorAll(".chips")) {
  group.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    for (const c of group.children) c.classList.toggle("is-active", c === chip);
  });
}

// ── Media bin: folders + items, shown as thumbnails or an AE-style list ──
const bin = {
  view: "grid",
  kind: "all",
  query: "",
  selected: "beach",
  nextFolder: 1,
  tree: [
    {
      type: "folder", id: "footage", name: "Footage", open: true,
      children: [
        { type: "item", id: "beach", name: "beach_sunset.mp4", kind: "video", dur: "00:08", res: "1080×1920", fps: 30, used: true, a: "oklch(0.62 0.1 240)", b: "oklch(0.84 0.11 60)" },
        { type: "item", id: "forest", name: "forest_walk.mov", kind: "video", dur: "00:21", res: "3840×2160", fps: 60, used: true, a: "oklch(0.45 0.08 160)", b: "oklch(0.7 0.12 130)" },
        {
          type: "folder", id: "broll", name: "B-roll", open: false,
          children: [
            { type: "item", id: "drone", name: "drone_city_prores.mov", kind: "video", dur: "00:14", res: "3840×2160", fps: 25, progress: 62, a: "oklch(0.35 0.05 280)", b: "oklch(0.55 0.1 320)" },
            { type: "item", id: "waves", name: "waves_slowmo.mp4", kind: "video", dur: "00:06", res: "1920×1080", fps: 120, a: "oklch(0.55 0.1 220)", b: "oklch(0.8 0.06 200)" },
          ],
        },
      ],
    },
    {
      type: "folder", id: "graphics", name: "Graphics", open: true,
      children: [
        { type: "item", id: "logo", name: "logo_overlay.png", kind: "image", dur: "—", res: "1024×1024", a: "oklch(0.8 0.08 30)", b: "oklch(0.9 0.05 80)" },
      ],
    },
    {
      type: "folder", id: "music", name: "Music", open: true,
      children: [{ type: "item", id: "vibes", name: "summer_vibes.mp3", kind: "audio", dur: "02:14", res: "48 kHz" }],
    },
    { type: "item", id: "intro", name: "Intro comp", kind: "comp", dur: "00:03", res: "1080×1920", fps: 30, a: "oklch(0.5 0.12 250)", b: "oklch(0.7 0.12 290)" },
  ],
};

const binEl = document.getElementById("media-grid");

const KIND_LABEL = { video: "Video", image: "Image", audio: "Audio", comp: "Composition" };
const KIND_ICON = {
  video: '<rect x="3" y="5" width="18" height="14" /><path d="m10 9 5 3-5 3z" />',
  image: '<rect x="3" y="4" width="18" height="16" /><circle cx="9" cy="10" r="2" /><path d="m21 17-5-5-9 8" />',
  audio: '<path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" />',
  comp: '<path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" />',
  folder: '<path d="M3 6h6l2 2h10v11H3z" />',
};
const CHECK = '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10" /></svg>';
const CARET = '<svg class="caret" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>';
const icon = (name) => `<svg class="kind-icon kind-${name}" viewBox="0 0 24 24">${KIND_ICON[name]}</svg>`;

function itemMatches(item) {
  if (bin.kind !== "all" && item.kind !== bin.kind) return false;
  return !bin.query || item.name.toLowerCase().includes(bin.query);
}

// A folder is shown when something inside it matches (or nothing is filtered)
function visibleChildren(nodes) {
  const filtering = bin.kind !== "all" || bin.query;
  return nodes.filter((n) => (n.type === "item" ? itemMatches(n) : !filtering || visibleChildren(n.children).length));
}

function countItems(nodes) {
  return nodes.reduce((sum, n) => sum + (n.type === "item" ? 1 : countItems(n.children)), 0);
}

function gridThumb(item) {
  const isAudio = item.kind === "audio";
  const style = isAudio ? "" : `style="--a: ${item.a}; --b: ${item.b}"`;
  const cls = ["thumb", isAudio && "thumb-audio", item.kind === "comp" && "thumb-comp"].filter(Boolean).join(" ");
  let inner = isAudio ? '<div class="wave"></div>' : "";
  if (item.progress != null) {
    inner += `<div class="proxy-progress"><svg class="seal-mini" viewBox="0 0 64 64"><use href="#seal-mark" /></svg><span>Optimizing</span><div class="bar"><i style="width: ${item.progress}%"></i></div></div>`;
  } else {
    if (item.kind === "comp") inner += `<span class="badge-kind badge-comp">${icon("comp")}COMP</span>`;
    else if (item.kind === "image") inner += '<span class="badge-kind">IMG</span>';
    else if (item.used) inner += `<span class="badge-used" title="Used in the timeline">${CHECK}</span>`;
    if (item.dur !== "—") inner += `<span class="badge-dur mono">${item.dur}</span>`;
  }
  return `<div class="${cls}" ${style}>${inner}</div>`;
}

function renderGrid(nodes) {
  const items = nodes.filter((n) => n.type === "item");
  const folders = nodes.filter((n) => n.type === "folder");
  let html = "";
  for (const f of folders) {
    const kids = visibleChildren(f.children);
    html += `<div class="bin-folder ${f.open ? "is-open" : ""}" data-folder="${f.id}">
      <button class="folder-head">${CARET}${icon("folder")}<span class="folder-name">${f.name}</span><span class="muted">${countItems(f.children)}</span></button>
      ${f.open ? `<div class="folder-body">${renderGrid(kids) || '<p class="folder-empty">Empty folder · drag media here</p>'}</div>` : ""}
    </div>`;
  }
  if (items.length) {
    html += `<div class="media-grid">${items
      .map(
        (it) => `<article class="media-item ${it.progress != null ? "is-processing" : ""} ${bin.selected === it.id ? "is-selected" : ""}" data-id="${it.id}" draggable="true">
          ${gridThumb(it)}<div class="media-name">${it.name}</div></article>`,
      )
      .join("")}</div>`;
  }
  return html;
}

function renderList(nodes, depth = 0) {
  return nodes
    .map((n) => {
      const indent = `style="--depth: ${depth}"`;
      if (n.type === "folder") {
        const head = `<div class="list-row list-folder ${n.open ? "is-open" : ""}" data-folder="${n.id}" ${indent}>
          <span class="cell-name">${CARET}${icon("folder")}<span class="name-text">${n.name}</span></span>
          <span class="cell-type muted">Folder</span><span class="cell-dur mono muted">${countItems(n.children)}</span><span class="cell-res"></span><span class="cell-fps"></span></div>`;
        return head + (n.open ? renderList(visibleChildren(n.children), depth + 1) : "");
      }
      const status = n.progress != null ? `<span class="list-progress" title="Optimizing ${n.progress}%"><i style="width: ${n.progress}%"></i></span>` : n.used ? `<span class="list-used" title="Used in the timeline">${CHECK}</span>` : "";
      const swatch = n.kind === "audio" ? "" : `<span class="swatch" style="--a: ${n.a}; --b: ${n.b}"></span>`;
      return `<div class="list-row ${bin.selected === n.id ? "is-selected" : ""}" data-id="${n.id}" draggable="true" ${indent}>
        <span class="cell-name"><span class="caret-space"></span>${icon(n.kind)}${swatch}<span class="name-text">${n.name}</span>${status}</span>
        <span class="cell-type muted">${KIND_LABEL[n.kind]}</span><span class="cell-dur mono">${n.dur}</span><span class="cell-res mono muted">${n.res}</span><span class="cell-fps mono muted">${n.fps ?? ""}</span></div>`;
    })
    .join("");
}

function renderBin() {
  const nodes = visibleChildren(bin.tree);
  binEl.dataset.view = bin.view;
  if (bin.view === "grid") {
    binEl.innerHTML = renderGrid(nodes);
  } else {
    binEl.innerHTML = `<div class="list-head"><span class="cell-name">Name</span><span class="cell-type">Type</span><span class="cell-dur">Duration</span><span class="cell-res">Size</span><span class="cell-fps">FPS</span></div>${renderList(nodes)}`;
  }
  document.getElementById("bin-count").textContent = `${countItems(bin.tree)} items`;
}

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === "folder") {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

function forEachFolder(nodes, fn) {
  for (const n of nodes) if (n.type === "folder") fn(n), forEachFolder(n.children, fn);
}

binEl.addEventListener("click", (event) => {
  const folderEl = event.target.closest("[data-folder]");
  const itemEl = event.target.closest("[data-id]");
  if (itemEl) {
    bin.selected = itemEl.dataset.id;
  } else if (folderEl && (event.target.closest(".folder-head") || folderEl.classList.contains("list-row"))) {
    const folder = findNode(bin.tree, folderEl.dataset.folder);
    folder.open = !folder.open;
  } else {
    return;
  }
  renderBin();
});

document.getElementById("bin-view").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view]");
  if (!button) return;
  for (const b of event.currentTarget.children) b.classList.toggle("is-active", b === button);
  bin.view = button.dataset.view;
  renderBin();
});

document.getElementById("media-filter").addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (!chip) return;
  bin.kind = chip.dataset.kind;
  renderBin();
});

document.querySelector('[data-pane="media"] .search input').addEventListener("input", (event) => {
  bin.query = event.target.value.trim().toLowerCase();
  renderBin();
});

document.getElementById("new-folder").addEventListener("click", () => {
  bin.tree.splice(0, 0, { type: "folder", id: `new-${bin.nextFolder}`, name: `New folder ${bin.nextFolder++}`, open: true, children: [] });
  renderBin();
});

document.getElementById("collapse-all").addEventListener("click", () => {
  let anyOpen = false;
  forEachFolder(bin.tree, (f) => (anyOpen ||= f.open));
  forEachFolder(bin.tree, (f) => (f.open = !anyOpen));
  renderBin();
});

renderBin();

// Prototype-only: flip between the filled bin and the seal's empty state
document.getElementById("empty-toggle").addEventListener("click", () => {
  const grid = document.getElementById("media-grid");
  const empty = document.getElementById("media-empty");
  const showEmpty = !grid.hidden;
  grid.hidden = showEmpty;
  empty.hidden = !showEmpty;
});

// ── Fake playback: advances the timecode ─────────────────────────────
const DURATION = 15;
const FPS = 30;
const play = document.getElementById("play");
const tcNow = document.getElementById("tc-now");
let time = 3.4;
let last = 0;
let raf = 0;

function formatTimecode(seconds) {
  const s = Math.floor(seconds);
  const frames = Math.floor((seconds - s) * FPS);
  const pad = (n) => String(n).padStart(2, "0");
  return `00:${pad(Math.floor(s / 60))}:${pad(s % 60)}.${pad(frames)}`;
}

function tick(now) {
  if (last) time = (time + (now - last) / 1000) % DURATION;
  last = now;
  tcNow.textContent = formatTimecode(time);
  raf = requestAnimationFrame(tick);
}

function togglePlay() {
  const playing = play.classList.toggle("is-playing");
  if (playing) {
    last = 0;
    raf = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(raf);
  }
}

play.addEventListener("click", togglePlay);
document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && event.target === document.body) {
    event.preventDefault();
    togglePlay();
  }
});

tcNow.textContent = formatTimecode(time);

// ── Resizable panels: drag the edges, double-click to reset ──────────
const app = document.querySelector(".app");
const SIZES_KEY = "cloudy-clip-prototype:sizes";

const resizeRules = {
  left: { prop: "--left-w", min: 260, max: 600, initial: 340, axis: "x", sign: 1 },
  right: { prop: "--right-w", min: 240, max: 520, initial: 300, axis: "x", sign: -1 },
  timeline: { prop: "--timeline-h", min: 140, max: () => window.innerHeight - 44 - 220, initial: null, axis: "y", sign: -1 },
};

function readSizes() {
  try {
    return JSON.parse(localStorage.getItem(SIZES_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveSizes(sizes) {
  try {
    localStorage.setItem(SIZES_KEY, JSON.stringify(sizes));
  } catch {
    // Storage blocked: sizes just won't be remembered.
  }
}

const sizes = readSizes();
for (const [key, px] of Object.entries(sizes)) app.style.setProperty(resizeRules[key].prop, `${px}px`);

for (const handle of document.querySelectorAll(".resizer")) {
  const key = handle.dataset.resize;
  const rule = resizeRules[key];
  const panel = handle.parentElement;

  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("is-dragging");
    document.body.classList.add(rule.axis === "x" ? "is-resizing-col" : "is-resizing-row");

    const start = rule.axis === "x" ? event.clientX : event.clientY;
    const startSize = rule.axis === "x" ? panel.offsetWidth : panel.offsetHeight;
    const max = typeof rule.max === "function" ? rule.max() : rule.max;

    const onMove = (e) => {
      const delta = (rule.axis === "x" ? e.clientX : e.clientY) - start;
      const size = Math.round(Math.min(max, Math.max(rule.min, startSize + delta * rule.sign)));
      app.style.setProperty(rule.prop, `${size}px`);
      sizes[key] = size;
    };

    const onUp = () => {
      handle.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing-col", "is-resizing-row");
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      saveSizes(sizes);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });

  handle.addEventListener("dblclick", () => {
    app.style.removeProperty(rule.prop);
    delete sizes[key];
    saveSizes(sizes);
  });
}
