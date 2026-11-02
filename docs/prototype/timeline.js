// Cloudy Clip prototype: the timeline. Not product code, but it follows the app's rules where it is
// cheap to: every change goes through `run()` (one undo history shared by you and the agent), and
// drags only move DOM until release, then commit once.

// ── Document ─────────────────────────────────────────────────────────
const C = {
  beach: ["oklch(0.62 0.1 240)", "oklch(0.84 0.11 60)"],
  forest: ["oklch(0.45 0.08 160)", "oklch(0.7 0.12 130)"],
  waves: ["oklch(0.55 0.1 220)", "oklch(0.8 0.06 200)"],
  drone: ["oklch(0.35 0.05 280)", "oklch(0.55 0.1 320)"],
};

function videoTrack(id, clips = []) {
  return { id, kind: "video", hidden: false, locked: false, clips };
}
function audioTrack(id, clips = []) {
  return { id, kind: "audio", muted: false, solo: false, locked: false, clips };
}

let doc = {
  nextId: 100,
  nextGroup: 2,
  nextComp: 1,
  seqs: {
    main: {
      name: "Main",
      tracks: [
        videoTrack("V3", [
          { id: "t1", kind: "text", name: "POV: your first edit", start: 0.4, dur: 5.1, group: "g1", props: { y: -560, size: 84, weight: "Black", animIn: "Pop" } },
          { id: "s1", kind: "sticker", name: "Seal sticker", start: 12, dur: 2.6, keys: [0.3, 1.4], props: { y: 420, scale: 140, animIn: "Pop" } },
        ]),
        videoTrack("V2", [
          { id: "t2", kind: "text", name: "and it only took 2 minutes", start: 1.2, dur: 4.3, group: "g1", props: { y: -400, size: 46, weight: "Medium", highlight: true, color: "#1f2430", animIn: "Slide up" } },
          { id: "c1", kind: "comp", name: "Intro comp", comp: "intro", start: 6, dur: 2.5 },
          { id: "l1", kind: "image", name: "logo_overlay.png", start: 9, dur: 5, fx: true, props: { x: 380, y: -740, scale: 35 } },
        ]),
        videoTrack("V1", [
          { id: "v1", kind: "video", name: "beach_sunset.mp4", start: 0, dur: 4, colors: C.beach, fx: true, keys: [0.5, 3.2], link: "a1" },
          { id: "v2", kind: "video", name: "forest_walk.mov", start: 4, dur: 5, colors: C.forest, trans: "Cross fade", link: "a2" },
          { id: "v3", kind: "video", name: "waves_slowmo.mp4", start: 9, dur: 3.5, colors: C.waves },
          { id: "v4", kind: "video", name: "drone_city.mov", start: 12.5, dur: 2.5, colors: C.drone },
        ]),
        audioTrack("A1", [
          { id: "a1", kind: "audio", name: "beach_sunset.mp4", start: 0, dur: 4, link: "v1" },
          { id: "a2", kind: "audio", name: "forest_walk.mov", start: 4, dur: 5, link: "v2" },
        ]),
        audioTrack("A2", [{ id: "m1", kind: "music", name: "summer_vibes.mp3", start: 0, dur: 15, keys: [0.2, 13.5, 14.8] }]),
      ],
    },
    intro: {
      name: "Intro comp",
      tracks: [
        videoTrack("V2", [{ id: "i1", kind: "text", name: "Cloudy", start: 0.3, dur: 2.2, props: { size: 150, weight: "Black", animIn: "Zoom", shadow: true } }]),
        videoTrack("V1", [{ id: "i2", kind: "video", name: "waves_slowmo.mp4", start: 0, dur: 2.5, colors: C.waves }]),
        audioTrack("A1"),
      ],
    },
  },
};

// ── View state (never in undo history) ───────────────────────────────
const view = {
  tabs: ["main"],
  active: "main",
  pps: 72, // pixels per second
  tool: "select",
  snap: true,
  linked: true,
  magnetic: true,
  mode: "simple",
  selected: new Set(),
  agentClip: null,
};

const TRACK_H = { video: 54, audio: 44 };
const RULER_H = 26;
const headW = () => (view.mode === "pro" ? 176 : 120);
const seq = () => doc.seqs[view.active];
const tracks = () => seq().tracks;

const scroll = document.getElementById("tl-scroll");
const content = document.getElementById("tl-content");
const toastEl = document.getElementById("toast");

// ── History: one stack for user and agent changes ────────────────────
const undoStack = [];
const redoStack = [];

/** Runs a change to the document. `origin` is "user" or "agent"; both can be undone. */
function run(label, mutate, origin = "user") {
  const before = JSON.stringify(doc);
  const ok = mutate();
  if (ok === false) return false;
  undoStack.push({ label, origin, before });
  redoStack.length = 0;
  render();
  return true;
}

function undo() {
  const entry = undoStack.pop();
  if (!entry) return toast("Nothing to undo");
  redoStack.push({ ...entry, before: JSON.stringify(doc) });
  doc = JSON.parse(entry.before);
  view.selected.clear();
  if (!doc.seqs[view.active]) view.active = "main";
  view.tabs = view.tabs.filter((t) => doc.seqs[t]);
  render();
  toast(`Undid ${entry.origin === "agent" ? "agent: " : ""}${entry.label}`);
}

function redo() {
  const entry = redoStack.pop();
  if (!entry) return toast("Nothing to redo");
  undoStack.push({ ...entry, before: JSON.stringify(doc) });
  doc = JSON.parse(entry.before);
  render();
  toast(`Redid ${entry.label}`);
}

let toastTimer = 0;
function toast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 2200);
}

// ── Queries ──────────────────────────────────────────────────────────
function allClips(s = seq()) {
  return s.tracks.flatMap((t) => t.clips.map((c) => ({ clip: c, track: t })));
}
function findClip(id, s = seq()) {
  return allClips(s).find((x) => x.clip.id === id);
}
const end = (c) => c.start + c.dur;
const isMain = (t) => t.id === "V1" && view.active === "main";
const fits = (kind, track) => (kind === "audio" || kind === "music" ? track.kind === "audio" : track.kind === "video");

function seqDuration(s = seq()) {
  return Math.max(0, ...allClips(s).map((x) => end(x.clip)));
}

/** Clips that move with this one: its group and (with linked selection) its linked audio/video. */
function companions(id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const { clip } of allClips()) {
      if (out.has(clip.id)) continue;
      const linkedIn = view.linked && clip.link && out.has(clip.link);
      const groupedIn = clip.group && [...out].some((o) => findClip(o)?.clip.group === clip.group);
      if (linkedIn || groupedIn) out.add(clip.id), (grew = true);
    }
  }
  return out;
}

// Keeps V1 gap-free when the magnetic main track is on; linked audio follows its video.
function packMain() {
  if (!view.magnetic || view.active !== "main") return;
  const main = tracks().find((t) => t.id === "V1");
  main.clips.sort((a, b) => a.start - b.start);
  let t = 0;
  for (const c of main.clips) {
    c.start = t;
    t += c.dur;
    const linked = c.link && findClip(c.link);
    if (linked) linked.clip.start = c.start;
  }
}

function overlaps(track, start, dur, ignore) {
  return track.clips.some((c) => !ignore.has(c.id) && start < end(c) - 1e-6 && start + dur > c.start + 1e-6);
}

/** The selection as the user thinks of it: linked audio rides along with its video, so it doesn't count. */
function primarySelection() {
  const ids = [...view.selected];
  return ids.filter((id) => {
    const c = findClip(id)?.clip;
    return !(c && (c.kind === "audio") && c.link && view.selected.has(c.link));
  });
}

// ── Rendering ────────────────────────────────────────────────────────
const ICON = {
  video: '<path d="m10 9 5 3-5 3z" /><rect x="3" y="5" width="18" height="14" />',
  image: '<rect x="3" y="4" width="18" height="16" /><circle cx="9" cy="10" r="2" /><path d="m21 17-5-5-9 8" />',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6" />',
  sticker: '<path d="M20 12a8 8 0 1 1-8-8h8z" />',
  comp: '<path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" />',
  audio: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10" />',
  music: '<path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" />',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />',
  lock: '<rect x="5" y="11" width="14" height="10" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />',
  magnet: '<path d="M6 4v7a6 6 0 0 0 12 0V4h-4v7a2 2 0 0 1-4 0V4z" />',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />',
  group: '<rect x="3" y="3" width="18" height="18" stroke-dasharray="3 2" />',
  close: '<path d="M6 6l12 12M18 6 6 18" />',
  fx: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />',
  trans: '<path d="M3 5l9 7-9 7zM21 5l-9 7 9 7z" />',
  file: '<path d="M6 3h8l5 5v13H6zM14 3v5h5" />',
};
const svg = (name, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24">${ICON[name]}</svg>`;

function rulerStep() {
  const steps = [1 / 30, 1 / 10, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  return steps.find((s) => s * view.pps >= 70) ?? 600;
}

function formatRuler(t, step) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const pad = (n) => String(n).padStart(2, "0");
  if (step < 1) return `${pad(s)}:${pad(Math.round((t - Math.floor(t)) * 30) % 30)}f`;
  return `${m}:${pad(s)}`;
}

function renderRuler(width) {
  const step = rulerStep();
  const minor = step / 5;
  let ticks = "";
  for (let i = 0; i * minor * view.pps < width; i++) {
    const t = Math.round(i * minor * 3000) / 3000; // integer steps: no float drift in labels
    const major = i % 5 === 0;
    ticks += `<span class="tick ${major ? "tick-major" : ""}" style="left:${t * view.pps}px">${major ? `<b>${formatRuler(t, step)}</b>` : ""}</span>`;
  }
  const markers = view.active === "main" ? [
    { t: 3, name: "Beat drop" },
    { t: 9, name: "Hook" },
  ] : [];
  for (const m of markers) ticks += `<span class="marker" style="left:${m.t * view.pps}px" title="Marker: ${m.name}"></span>`;
  return `<div class="tl-ruler" id="tl-ruler">${ticks}</div>`;
}

function waveBg(seed) {
  let d = "";
  for (let x = 0; x < 120; x += 3) {
    const h = 4 + Math.abs(Math.sin(x * 0.37 + seed) * 9 + Math.sin(x * 0.11 + seed * 2) * 6);
    d += `M${x} ${16 - h / 2}v${h}`;
  }
  const s = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='32'><path d='${d}' stroke='white' stroke-opacity='.55' stroke-width='1.6'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
}

function clipHtml(clip, track) {
  const x = clip.start * view.pps;
  const w = Math.max(4, clip.dur * view.pps);
  const cls = ["clip", `clip-${clip.kind}`];
  if (view.selected.has(clip.id)) cls.push("is-selected");
  if (clip.group) cls.push("is-grouped");
  if (view.agentClip === clip.id) cls.push("is-agent");
  if (track.hidden || track.muted) cls.push("is-off");
  if (w < 48) cls.push("is-tiny");

  let style = `left:${x}px;width:${w}px;`;
  if (clip.colors) style += `--a:${clip.colors[0]};--b:${clip.colors[1]};`;
  if (clip.kind === "audio" || clip.kind === "music") style += `--wave:${waveBg(clip.id.length + clip.name.length)};`;

  const badges = [
    clip.group ? `<span class="cb" title="Grouped">${svg("group")}</span>` : "",
    clip.link && view.mode === "pro" ? `<span class="cb" title="Linked">${svg("link")}</span>` : "",
    clip.fx ? '<span class="cb cb-fx" title="Has effects">fx</span>' : "",
  ].join("");

  const keys = (clip.keys ?? [])
    .filter((k) => k < clip.dur)
    .map((k) => `<i class="kf" style="left:${k * view.pps}px" title="Keyframe"></i>`)
    .join("");

  const trans = clip.trans
    ? `<div class="trans" style="width:${Math.min(0.6, clip.dur / 2) * view.pps}px" title="${clip.trans}"></div>`
    : "";

  return `<div class="${cls.join(" ")}" data-clip="${clip.id}" style="${style}">
    ${trans}
    <div class="clip-head">${svg(clip.kind)}<span class="clip-name">${clip.name}</span>${badges}</div>
    <div class="clip-body"></div>
    ${keys}
    <div class="trim trim-l" data-trim="l"></div><div class="trim trim-r" data-trim="r"></div>
  </div>`;
}

function trackHeadHtml(track) {
  const label = { V1: "Main", V2: "Overlay", V3: "Text" }[track.id] ?? "";
  const kindIcon = track.kind === "video" ? svg(isMain(track) && view.magnetic ? "magnet" : "video") : svg("music");
  const pro = view.mode === "pro";
  const toggles =
    track.kind === "video"
      ? `<button class="th-btn ${track.hidden ? "is-off" : ""}" data-toggle="hidden" title="Show / hide track">${svg("eye")}</button>`
      : `<button class="th-btn th-txt ${track.muted ? "is-on-warn" : ""}" data-toggle="muted" title="Mute">M</button>` +
        (pro ? `<button class="th-btn th-txt ${track.solo ? "is-on" : ""}" data-toggle="solo" title="Solo">S</button>` : "");
  const lock = pro ? `<button class="th-btn ${track.locked ? "is-on" : ""}" data-toggle="locked" title="Lock track">${svg("lock")}</button>` : "";
  return `<div class="th th-${track.kind} ${isMain(track) ? "th-main" : ""}" data-track="${track.id}" style="height:${TRACK_H[track.kind]}px">
    <span class="th-id">${pro ? track.id : kindIcon}</span>
    <span class="th-label">${pro ? label || (track.kind === "audio" ? "Audio" : "") : label || (track.kind === "audio" ? (track.id === "A1" ? "Original" : "Music") : "")}</span>
    <span class="th-btns">${toggles}${lock}</span>
  </div>`;
}

function groupBoxes() {
  const groups = {};
  tracks().forEach((t, ti) => {
    for (const c of t.clips) {
      if (!c.group) continue;
      const g = (groups[c.group] ??= { s: Infinity, e: 0, t0: Infinity, t1: 0 });
      g.s = Math.min(g.s, c.start);
      g.e = Math.max(g.e, end(c));
      g.t0 = Math.min(g.t0, ti);
      g.t1 = Math.max(g.t1, ti);
    }
  });
  const tops = trackTops();
  return Object.entries(groups)
    .map(([id, g]) => {
      const top = tops[g.t0];
      const bottom = tops[g.t1] + TRACK_H[tracks()[g.t1].kind];
      return `<div class="group-box" style="left:${g.s * view.pps - 2}px;width:${(g.e - g.s) * view.pps + 4}px;top:${top - 1}px;height:${bottom - top + 2}px"><span>Group ${id.slice(1)}</span></div>`;
    })
    .join("");
}

function trackTops() {
  const tops = [];
  let y = 0;
  for (const t of tracks()) tops.push(y), (y += TRACK_H[t.kind]);
  return tops;
}

function renderTabs() {
  const tabs = view.tabs
    .map((id, i) => {
      const s = doc.seqs[id];
      const isComp = id !== "main";
      return `${i ? '<span class="crumb-sep">›</span>' : ""}<button class="tl-tab ${id === view.active ? "is-active" : ""}" data-seq="${id}">
        ${svg(isComp ? "comp" : "video")}<span>${s.name}</span>${isComp ? `<span class="tab-close" data-close="${id}" title="Close">${svg("close")}</span>` : ""}</button>`;
    })
    .join("");
  const hint = view.active !== "main" ? '<span class="tl-tabs-hint">Editing inside a composition · changes show everywhere it is used</span>' : "";
  document.getElementById("tl-tabs").innerHTML = tabs + hint;
}

function render() {
  const width = Math.max(seqDuration() + 12, scroll.clientWidth / view.pps) * view.pps;
  const hw = headW();
  content.style.setProperty("--head-w", `${hw}px`);
  content.style.width = `${hw + width}px`;

  const heads = tracks().map(trackHeadHtml).join("");
  const lanes = tracks()
    .map(
      (t) =>
        `<div class="lane lane-${t.kind} ${isMain(t) ? "lane-main" : ""} ${t.locked ? "is-locked" : ""}" data-track="${t.id}" style="height:${TRACK_H[t.kind]}px">${t.clips.map((c) => clipHtml(c, t)).join("")}</div>`,
    )
    .join("");
  const firstAudio = tracks().findIndex((t) => t.kind === "audio");
  const divider = firstAudio > 0 ? `<div class="av-divider" style="top:${RULER_H + trackTops()[firstAudio]}px"></div>` : "";

  content.innerHTML = `
    <div class="tl-corner"><span class="mono" id="tl-tc"></span></div>
    <div class="tl-ruler-wrap">${renderRuler(width)}</div>
    <div class="tl-heads">${heads}</div>
    <div class="tl-lanes" id="tl-lanes">${lanes}${groupBoxes()}<div class="snap-line" id="snap-line" hidden></div><div class="razor-line" id="razor-line" hidden></div></div>
    ${divider}
    <div class="playhead" id="playhead"><i></i></div>
    <div class="agent-cursor" id="agent-cursor" hidden><span class="agent-label"><svg class="agent-spark" viewBox="0 0 32 32"><use href="#claude-spark" /></svg><b id="agent-text">Agent</b></span></div>`;

  renderTabs();
  updatePlayhead();
  if (agent.running) placeAgentCursor(agent.t, agent.text, false);
  document.body.dataset.tool = view.tool;
  window.dispatchEvent(new CustomEvent("timeline:selection", { detail: [...view.selected] }));
}

// ── Playhead (per frame: DOM only) ───────────────────────────────────
function updatePlayhead() {
  const ph = document.getElementById("playhead");
  if (!ph) return;
  ph.style.transform = `translateX(${headW() + time * view.pps}px)`;
  const tc = document.getElementById("tl-tc");
  if (tc) tc.textContent = formatTimecode(time);
}
(function loop() {
  updatePlayhead();
  requestAnimationFrame(loop);
})();

function timeAt(clientX) {
  const rect = content.getBoundingClientRect();
  return Math.max(0, (clientX - rect.left - headW()) / view.pps);
}

function setTime(t) {
  time = Math.min(t, 600);
  tcNow.textContent = formatTimecode(time);
  updatePlayhead();
}

// Scrub on the ruler
content.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".tl-ruler-wrap")) return;
  event.preventDefault();
  const move = (e) => setTime(snapTime(timeAt(e.clientX), new Set(), true));
  move(event);
  const up = () => (window.removeEventListener("pointermove", move), window.removeEventListener("pointerup", up));
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});

// ── Snapping ─────────────────────────────────────────────────────────
function snapCandidates(ignore, withPlayhead = true) {
  const out = [0];
  if (withPlayhead) out.push(time);
  for (const { clip } of allClips()) if (!ignore.has(clip.id)) out.push(clip.start, end(clip));
  return out;
}

function snapTime(t, ignore, skipPlayhead = false) {
  if (!view.snap) return t;
  const threshold = 8 / view.pps;
  let best = t;
  let bestD = threshold;
  for (const c of snapCandidates(ignore, !skipPlayhead)) {
    const d = Math.abs(c - t);
    if (d < bestD) (best = c), (bestD = d);
  }
  return best;
}

/** Best delta so any edge of the moving clips lands on a candidate. */
function snapDelta(moving, delta) {
  if (!view.snap) return { delta, at: null };
  const threshold = 8 / view.pps;
  const cands = snapCandidates(new Set(moving.map((c) => c.id)));
  let best = { delta, at: null, d: threshold };
  for (const c of moving) {
    for (const edge of [c.start + delta, end(c) + delta]) {
      for (const cand of cands) {
        const d = Math.abs(cand - edge);
        if (d < best.d) best = { delta: delta + (cand - edge), at: cand, d };
      }
    }
  }
  return best;
}

function showSnap(at) {
  const line = document.getElementById("snap-line");
  if (!line) return;
  line.hidden = at == null;
  if (at != null) line.style.left = `${at * view.pps}px`;
}

// ── Pointer: select, move, trim, razor ───────────────────────────────
function laneAt(clientY) {
  const lanes = [...document.querySelectorAll(".lane")];
  return lanes.find((l) => {
    const r = l.getBoundingClientRect();
    return clientY >= r.top && clientY < r.bottom;
  });
}

content.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const clipEl = event.target.closest(".clip");
  const laneEl = event.target.closest(".lane");
  hideMenu();

  if (view.tool === "hand" && event.target.closest(".tl-lanes")) return startPan(event);
  if (!clipEl) {
    if (laneEl) (view.selected.clear(), render());
    return;
  }

  const id = clipEl.dataset.clip;
  const { clip, track } = findClip(id);
  if (track.locked) return toast(`${track.id} is locked`);

  if (view.tool === "razor") {
    const t = snapTime(timeAt(event.clientX), new Set([id]), false);
    splitClips([id], t, "Cut clip");
    return;
  }

  if (view.tool === "track") {
    // Select this clip and everything after it on every track
    view.selected = new Set(allClips().filter((x) => x.clip.start >= clip.start - 1e-6).map((x) => x.clip.id));
    render();
    return;
  }

  // Selection (re-render only when it changes, so a double-click still lands on the same clip)
  const group = companions(id);
  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    const on = !view.selected.has(id);
    for (const g of group) on ? view.selected.add(g) : view.selected.delete(g);
    render();
  } else if (!view.selected.has(id)) {
    view.selected = new Set(group);
    render();
  }

  const trimSide = event.target.closest(".trim")?.dataset.trim;
  if (trimSide) return startTrim(event, id, trimSide);
  if (view.tool === "select" || view.tool === "ripple" || view.tool === "slip") startMove(event, id);
});

function startMove(event, id) {
  const startX = event.clientX;
  const moving = [...view.selected].map((s) => findClip(s)).filter(Boolean);
  const els = moving.map((m) => content.querySelector(`[data-clip="${m.clip.id}"]`));
  const startLane = laneAt(event.clientY)?.dataset.track ?? findClip(id).track.id;
  const trackIds = tracks().map((t) => t.id);
  let delta = 0;
  let trackShift = 0;
  let dragging = false;

  const startY = event.clientY;
  const move = (e) => {
    if (!dragging && Math.abs(e.clientX - startX) < 3 && Math.abs(e.clientY - startY) < 3) return;
    dragging = true;
    const raw = (e.clientX - startX) / view.pps;
    const minStart = Math.min(...moving.map((m) => m.clip.start));
    const snapped = snapDelta(moving.map((m) => m.clip), Math.max(-minStart, raw));
    delta = Math.max(-minStart, snapped.delta);
    showSnap(snapped.at);

    const lane = laneAt(e.clientY)?.dataset.track;
    trackShift = lane ? trackIds.indexOf(lane) - trackIds.indexOf(startLane) : trackShift;
    const tops = trackTops();
    moving.forEach((m, i) => {
      const from = trackIds.indexOf(m.track.id);
      const to = Math.min(trackIds.length - 1, Math.max(0, from + trackShift));
      const dy = tops[to] - tops[from];
      els[i].style.transform = `translate(${delta * view.pps}px, ${dy}px)`;
      els[i].classList.add("is-dragging");
    });
  };

  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    showSnap(null);
    if (!dragging) return;
    const ok = run(moving.length > 1 ? `Move ${moving.length} clips` : "Move clip", () => moveClips(moving, delta, trackShift));
    if (!ok) {
      render();
      toast("No room there: clips can't overlap on a track");
    }
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function moveClips(moving, delta, trackShift) {
  const list = tracks();
  const ids = new Set(moving.map((m) => m.clip.id));
  const plan = moving.map((m) => {
    const from = list.indexOf(m.track);
    const to = list[Math.min(list.length - 1, Math.max(0, from + trackShift))];
    return { clip: m.clip, from: m.track, to, start: m.clip.start + delta };
  });
  // Every target track must accept the clip's kind
  if (plan.some((p) => !fits(p.clip.kind, p.to) || p.to.locked)) return false;
  // Only V1 with magnetic on reorders; everywhere else, overlaps are refused
  const magneticTarget = (p) => view.magnetic && isMain(p.to);
  // Audio linked to a clip on the magnetic main track is re-placed by packMain, so skip its check
  const followsMain = (p) => plan.some((q) => q.clip.id === p.clip.link && magneticTarget(q));
  if (plan.some((p) => !magneticTarget(p) && !followsMain(p) && overlaps(p.to, p.start, p.clip.dur, ids))) return false;

  for (const p of plan) {
    p.from.clips.splice(p.from.clips.indexOf(p.clip), 1);
    p.clip.start = p.start;
    if (magneticTarget(p)) {
      // Insert where it was dropped: before the clip whose middle it passed
      p.clip.start = p.start - 1e-3;
    }
    p.to.clips.push(p.clip);
  }
  packMain();
  return true;
}

function startTrim(event, id, side) {
  const { clip, track } = findClip(id);
  const el = content.querySelector(`[data-clip="${id}"]`);
  const startX = event.clientX;
  const neighbours = track.clips.filter((c) => c !== clip);
  const prevEnd = Math.max(0, ...neighbours.filter((c) => end(c) <= clip.start + 1e-6).map(end));
  const nextStart = Math.min(Infinity, ...neighbours.filter((c) => c.start >= end(clip) - 1e-6).map((c) => c.start));
  const magnetic = view.magnetic && isMain(track);
  let start = clip.start;
  let dur = clip.dur;

  const move = (e) => {
    const raw = (e.clientX - startX) / view.pps;
    if (side === "l") {
      let s = snapTime(clip.start + raw, new Set([id]));
      s = Math.min(end(clip) - 0.2, Math.max(magnetic ? 0 : prevEnd, s));
      start = s;
      dur = end(clip) - s;
    } else {
      let e2 = snapTime(end(clip) + raw, new Set([id]));
      e2 = Math.max(clip.start + 0.2, magnetic ? e2 : Math.min(nextStart, e2));
      start = clip.start;
      dur = e2 - clip.start;
    }
    el.style.left = `${start * view.pps}px`;
    el.style.width = `${dur * view.pps}px`;
    showSnap(side === "l" ? start : start + dur);
  };

  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    showSnap(null);
    if (start === clip.start && dur === clip.dur) return;
    run("Trim clip", () => {
      const c = findClip(id).clip;
      c.start = start;
      c.dur = dur;
      packMain();
    });
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function startPan(event) {
  const x = event.clientX;
  const left = scroll.scrollLeft;
  const move = (e) => (scroll.scrollLeft = left - (e.clientX - x));
  const up = () => (window.removeEventListener("pointermove", move), window.removeEventListener("pointerup", up));
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

// Razor preview line follows the mouse over clips
content.addEventListener("pointermove", (event) => {
  const line = document.getElementById("razor-line");
  if (!line) return;
  const over = view.tool === "razor" && event.target.closest(".clip");
  line.hidden = !over;
  if (over) line.style.left = `${snapTime(timeAt(event.clientX), new Set()) * view.pps}px`;
});

// ── Edits ────────────────────────────────────────────────────────────
function splitClips(ids, t, label = "Split") {
  const targets = ids.map((id) => findClip(id)).filter((x) => x && t > x.clip.start + 0.05 && t < end(x.clip) - 0.05);
  if (!targets.length) return toast("Move the playhead over a clip to split it");
  run(label, () => {
    for (const { clip, track } of targets) {
      const right = { ...clip, id: `c${doc.nextId++}`, start: t, dur: end(clip) - t, trans: undefined, link: undefined };
      right.keys = (clip.keys ?? []).filter((k) => k > t - clip.start).map((k) => k - (t - clip.start));
      clip.keys = (clip.keys ?? []).filter((k) => k < t - clip.start);
      clip.dur = t - clip.start;
      track.clips.splice(track.clips.indexOf(clip) + 1, 0, right);
    }
  });
}

function splitAtPlayhead() {
  const ids = view.selected.size
    ? [...view.selected]
    : allClips()
        .filter((x) => !x.track.locked && time > x.clip.start && time < end(x.clip))
        .map((x) => x.clip.id);
  splitClips(ids, time);
}

function deleteSelected() {
  if (!view.selected.size) return toast("Select a clip first");
  const ids = new Set(view.selected);
  run(ids.size > 1 ? `Delete ${ids.size} clips` : "Delete clip", () => {
    for (const t of tracks()) t.clips = t.clips.filter((c) => !ids.has(c.id));
    for (const { clip } of allClips()) if (ids.has(clip.link)) clip.link = undefined;
    packMain();
  });
  view.selected.clear();
  render();
}

function toggleGroup() {
  const ids = [...view.selected];
  if (!ids.length) return toast("Select clips to group");
  const groupsIn = new Set(ids.map((id) => findClip(id).clip.group).filter(Boolean));
  const allSameGroup = groupsIn.size === 1 && ids.every((id) => findClip(id).clip.group);
  if (allSameGroup) {
    run("Ungroup", () => ids.forEach((id) => (findClip(id).clip.group = undefined)));
    toast("Ungrouped");
  } else {
    if (ids.length < 2) return toast("Select two or more clips to group");
    const g = `g${doc.nextGroup++}`;
    run("Group clips", () => ids.forEach((id) => (findClip(id).clip.group = g)));
    toast(`Grouped ${ids.length} clips · Ctrl+G again to ungroup`);
  }
}

function makeComposition() {
  const ids = new Set(view.selected);
  if (!ids.size) return toast("Select clips to turn into a composition");
  const picked = allClips().filter((x) => ids.has(x.clip.id));
  const s = Math.min(...picked.map((x) => x.clip.start));
  const e = Math.max(...picked.map((x) => end(x.clip)));
  const list = tracks();
  const host = list.find((t) => picked.some((x) => x.track === t));
  if (host.clips.some((c) => !ids.has(c.id) && c.start < e && end(c) > s)) {
    return toast(`Can't fit: another clip on ${host.id} sits inside the selection's time range`);
  }
  const compId = `comp${doc.nextComp}`;
  const name = `Composition ${doc.nextComp}`;
  run("Make composition", () => {
    doc.nextComp++;
    doc.seqs[compId] = {
      name,
      tracks: list
        .filter((t) => t.clips.some((c) => ids.has(c.id)))
        .map((t) => ({ ...t, clips: t.clips.filter((c) => ids.has(c.id)).map((c) => ({ ...c, start: c.start - s, group: undefined, link: undefined })) })),
    };
    for (const t of list) t.clips = t.clips.filter((c) => !ids.has(c.id));
    host.clips.push({ id: `c${doc.nextId++}`, kind: "comp", name, comp: compId, start: s, dur: e - s });
    packMain();
  });
  view.selected.clear();
  render();
  toast(`${name} created · double-click it to open`);
}

function openComp(seqId) {
  if (!doc.seqs[seqId]) return;
  const at = view.tabs.indexOf(view.active);
  view.tabs = [...view.tabs.slice(0, at + 1).filter((t) => t !== seqId), seqId];
  view.active = seqId;
  view.selected.clear();
  render();
}

content.addEventListener("dblclick", (event) => {
  const el = event.target.closest(".clip");
  if (!el) return;
  const { clip } = findClip(el.dataset.clip);
  if (clip.kind === "comp") openComp(clip.comp);
});

document.getElementById("tl-tabs").addEventListener("click", (event) => {
  const close = event.target.closest("[data-close]");
  if (close) {
    const i = view.tabs.indexOf(close.dataset.close);
    view.tabs = view.tabs.slice(0, i);
    view.active = view.tabs.at(-1);
  } else {
    const tab = event.target.closest("[data-seq]");
    if (!tab) return;
    view.active = tab.dataset.seq;
  }
  view.selected.clear();
  render();
});

// Track header toggles (view-level, but in a real app hide/mute/lock are document state)
content.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-toggle]");
  if (!btn) return;
  const track = tracks().find((t) => t.id === btn.closest("[data-track]").dataset.track);
  const key = btn.dataset.toggle;
  run(`${key === "hidden" ? "Hide" : key === "muted" ? "Mute" : key === "solo" ? "Solo" : "Lock"} ${track.id}`, () => {
    track[key] = !track[key];
  });
});

// ── Context menu ─────────────────────────────────────────────────────
const menu = document.getElementById("ctx-menu");
function hideMenu() {
  menu.hidden = true;
}
content.addEventListener("contextmenu", (event) => {
  const el = event.target.closest(".clip");
  if (!el) return;
  event.preventDefault();
  const id = el.dataset.clip;
  if (!view.selected.has(id)) view.selected = companions(id);
  render();
  const { clip } = findClip(id);
  const grouped = !!clip.group;
  const items = [
    ["split", "Split at playhead", "S"],
    ["delete", "Delete", "Del"],
    ["-"],
    ["group", grouped ? "Ungroup" : "Group", "Ctrl+G"],
    ["comp", "Make composition", "Ctrl+Alt+C", "pro"],
    clip.kind === "comp" ? ["open", "Open composition", "Dbl-click"] : null,
    ["-"],
    ["fx", "Add effect…", "", "soon"],
    ["speed", "Speed…", "", "soon"],
  ].filter(Boolean);
  menu.innerHTML = items
    .map(([act, label, key, flag]) =>
      act === "-"
        ? '<hr />'
        : `<button data-act="${act}" class="${flag === "pro" ? "pro-only" : ""}" ${flag === "soon" ? "disabled" : ""}><span>${label}</span><kbd>${flag === "soon" ? "Soon" : key}</kbd></button>`,
    )
    .join("");
  menu.dataset.clip = id;
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(event.clientX, innerWidth - r.width - 8)}px`;
  menu.style.top = `${Math.min(event.clientY, innerHeight - r.height - 8)}px`;
});
menu.addEventListener("click", (event) => {
  const act = event.target.closest("[data-act]")?.dataset.act;
  if (!act) return;
  hideMenu();
  if (act === "split") splitClips([...view.selected], time);
  if (act === "delete") deleteSelected();
  if (act === "group") toggleGroup();
  if (act === "comp") makeComposition();
  if (act === "open") openComp(findClip(menu.dataset.clip).clip.comp);
});
window.addEventListener("pointerdown", (e) => !menu.contains(e.target) && hideMenu());

// ── Toolbar ──────────────────────────────────────────────────────────
function setTool(tool) {
  view.tool = tool;
  for (const b of document.querySelectorAll("#tl-tools [data-tool]")) b.classList.toggle("is-on", b.dataset.tool === tool);
  document.body.dataset.tool = tool;
  if (tool === "ripple" || tool === "slip") toast("Prototype: this tool acts like Selection for now");
}
document.getElementById("tl-tools").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tool]");
  if (b) setTool(b.dataset.tool);
});

function toggleFlag(btnId, key, label) {
  const btn = document.getElementById(btnId);
  btn.addEventListener("click", () => {
    view[key] = !view[key];
    btn.classList.toggle("is-on", view[key]);
    toast(`${label} ${view[key] ? "on" : "off"}`);
    if (key === "magnetic" && view.magnetic) run("Close gaps on main track", () => packMain());
    else render();
  });
}
toggleFlag("tl-snap", "snap", "Snapping");
toggleFlag("tl-linked", "linked", "Linked selection");
toggleFlag("tl-magnet", "magnetic", "Magnetic main track");

document.getElementById("tl-split").addEventListener("click", splitAtPlayhead);
document.getElementById("tl-delete").addEventListener("click", deleteSelected);
document.getElementById("tl-group").addEventListener("click", toggleGroup);
document.getElementById("tl-comp").addEventListener("click", makeComposition);
document.getElementById("undo").addEventListener("click", undo);
document.getElementById("redo").addEventListener("click", redo);

const zoom = document.getElementById("zoom");
function setZoom(pps, anchorClientX) {
  const rect = scroll.getBoundingClientRect();
  const ax = anchorClientX ?? rect.left + headW() + (time * view.pps - scroll.scrollLeft);
  const tAtAnchor = (ax - rect.left - headW() + scroll.scrollLeft) / view.pps;
  view.pps = Math.min(480, Math.max(16, pps));
  zoom.value = view.pps;
  render();
  scroll.scrollLeft = tAtAnchor * view.pps - (ax - rect.left - headW());
}
zoom.addEventListener("input", () => setZoom(Number(zoom.value)));
document.getElementById("zoom-in").addEventListener("click", () => setZoom(view.pps * 1.4));
document.getElementById("zoom-out").addEventListener("click", () => setZoom(view.pps / 1.4));
document.getElementById("zoom-fit").addEventListener("click", fitZoom);
function fitZoom() {
  view.pps = Math.max(16, (scroll.clientWidth - headW() - 40) / Math.max(1, seqDuration()));
  zoom.value = view.pps;
  render();
  scroll.scrollLeft = 0;
}
scroll.addEventListener(
  "wheel",
  (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(view.pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX);
  },
  { passive: false },
);

// Simple / Pro
const MODE_KEY = "cloudy-clip-prototype:mode";
function setMode(mode) {
  view.mode = mode;
  document.body.classList.toggle("mode-simple", mode === "simple");
  document.body.classList.toggle("mode-pro", mode === "pro");
  for (const b of document.querySelectorAll("#tl-mode button")) b.classList.toggle("is-active", b.dataset.mode === mode);
  if (mode === "simple") {
    setTool("select");
    view.snap = true;
    view.linked = true;
  }
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // not remembered
  }
  render();
}
document.getElementById("tl-mode").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (b) setMode(b.dataset.mode);
});

// ── Keyboard (Premiere-compatible where it matters) ──────────────────
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea")) return;
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (mod && k === "z") return e.preventDefault(), e.shiftKey ? redo() : undo();
  if (mod && k === "y") return e.preventDefault(), redo();
  if (mod && k === "g") return e.preventDefault(), toggleGroup();
  if (mod && e.altKey && k === "c") return e.preventDefault(), makeComposition();
  if (mod && k === "k") return e.preventDefault(), splitAtPlayhead();
  if (mod) return;
  if (k === "delete" || k === "backspace") return deleteSelected();
  if (k === "s") return splitAtPlayhead();
  if (k === "escape") return view.selected.clear(), hideMenu(), render();
  if (k === "+" || k === "=") return setZoom(view.pps * 1.4);
  if (k === "-") return setZoom(view.pps / 1.4);
  if (k === "z" && e.shiftKey) return fitZoom();
  if (k === "arrowleft") return setTime(Math.max(0, time - 1 / 30));
  if (k === "arrowright") return setTime(time + 1 / 30);
  if (k === "home") return setTime(0);
  if (k === "end") return setTime(seqDuration());
  if (view.mode !== "pro") return;
  const tools = { v: "select", a: "track", b: "ripple", c: "razor", y: "slip", h: "hand" };
  if (tools[k]) return setTool(tools[k]);
  if (k === "n") return document.getElementById("tl-snap").click();
});

// ── Agent demo: a scripted agent edits the same live project ─────────
const agent = { running: false, timers: [], t: 0, text: "", changes: 0 };

function placeAgentCursor(t, text, animate = true) {
  const cur = document.getElementById("agent-cursor");
  if (!cur) return;
  agent.t = t;
  agent.text = text;
  cur.hidden = false;
  cur.classList.toggle("no-anim", !animate);
  cur.style.transform = `translateX(${headW() + t * view.pps}px)`;
  document.getElementById("agent-text").textContent = text;
  window.dispatchEvent(new CustomEvent("agent:status", { detail: { running: agent.running, text, t } }));
}

function agentStep(delay, fn) {
  agent.timers.push(setTimeout(() => agent.running && fn(), delay));
}

function agentRun(label, mutate) {
  if (run(label, mutate, "agent")) agent.changes++;
}

function startAgent() {
  if (agent.running) return;
  if (window.agentAccess === "view") return toast("Claude Code is view-only: it can read the project but not change it");
  if (window.agentAccess === "off") return toast("No agent connected");
  if (view.active !== "main") openMain();
  agent.running = true;
  agent.changes = 0;
  document.getElementById("agent-status").hidden = false;
  placeAgentCursor(0, "Reading the timeline…", false);

  const clipT = (id) => findClip(id)?.clip;

  agentStep(900, () => {
    const c = clipT("v2");
    if (!c) return;
    view.agentClip = "v2";
    placeAgentCursor(c.start + c.dur / 2, `Looking at ${c.name}`);
    render();
  });
  agentStep(2300, () => {
    const c = clipT("v2");
    if (!c) return;
    placeAgentCursor(end(c) - 1, "Trimming 1s off the end");
    agentRun("Trim forest_walk.mov", () => {
      c.dur = Math.max(0.5, c.dur - 1);
      const a = clipT("a2");
      if (a) a.dur = c.dur;
      packMain();
    });
  });
  agentStep(3800, () => {
    view.agentClip = null;
    placeAgentCursor(6.5, "Adding a caption");
    agentRun("Add text “Follow for more”", () => {
      const v3 = tracks().find((t) => t.id === "V3");
      if (overlaps(v3, 6.5, 4, new Set())) return false;
      const id = `c${doc.nextId++}`;
      v3.clips.push({ id, kind: "text", name: "Follow for more", start: 6.5, dur: 4, props: { y: 560, size: 56, weight: "Bold", stroke: true, animIn: "Slide up" } });
      view.agentClip = id;
    });
    render();
  });
  agentStep(5400, () => {
    const c = clipT("v4");
    if (!c) return;
    view.agentClip = "v4";
    placeAgentCursor(c.start, "Adding a transition");
    agentRun("Add cross fade", () => (c.trans = "Cross fade"));
  });
  agentStep(7000, () => {
    view.agentClip = null;
    placeAgentCursor(agent.t, `Done · ${agent.changes} changes`);
    render();
    toast(`Agent made ${agent.changes} changes · Ctrl+Z undoes them one by one`);
  });
  agentStep(9000, stopAgent);
}

function stopAgent() {
  agent.running = false;
  agent.timers.forEach(clearTimeout);
  agent.timers = [];
  view.agentClip = null;
  document.getElementById("agent-status").hidden = true;
  render();
  window.dispatchEvent(new CustomEvent("agent:status", { detail: { running: false } }));
}

function openMain() {
  view.active = "main";
  view.selected.clear();
}

document.getElementById("agent-demo").addEventListener("click", () => (agent.running ? stopAgent() : startAgent()));
document.getElementById("agent-stop").addEventListener("click", stopAgent);

// ── Start ────────────────────────────────────────────────────────────
let savedMode = "simple";
try {
  savedMode = localStorage.getItem(MODE_KEY) ?? "simple";
} catch {
  // default
}
setMode(savedMode);
new ResizeObserver(() => render()).observe(scroll);
