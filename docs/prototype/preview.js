// Cloudy Clip prototype: the preview draws what the timeline has under the playhead.
// Layers are kept per clip and only restyled each frame (no rebuild), like the real engine.
// Select a layer to move, scale or rotate it on the canvas; release commits one command.

const layersEl = document.getElementById("layers");
const selBox = document.getElementById("sel-box");
const beachTpl = document.getElementById("beach-scene");
const FRAME_W = 1080;
const FRAME_H = 1920;

const layerEls = new Map(); // key -> element
const overrides = {}; // live values while dragging a slider or a handle, before commit

window.addEventListener("inspector:preview", (e) => {
  const { id, key, value } = e.detail;
  if (id) (overrides[id] ??= {})[key] = value;
});
window.addEventListener("timeline:selection", () => {
  for (const k of Object.keys(overrides)) delete overrides[k];
});

const pv = (clip, key) => overrides[clip.id]?.[key] ?? (isBypassed(clip, key) ? DEFAULTS[key] : prop(clip, key));

// ── What is visible at a time, bottom track first ────────────────────
function visibleAt(s, t, prefix = "") {
  const out = [];
  for (const track of [...s.tracks].reverse()) {
    if (track.kind !== "video" || track.hidden) continue;
    for (const clip of track.clips) {
      const local = t - clip.start;
      if (local >= 0 && local < clip.dur) out.push({ clip, local, key: prefix + clip.id });
      // Cross fade: keep the outgoing clip underneath while the next one fades in
      const next = track.clips.find((c) => c.trans && Math.abs(c.start - end(clip)) < 1e-3);
      if (next) {
        const into = t - next.start;
        const fadeLen = Math.min(0.6, next.dur / 2);
        if (into >= 0 && into < fadeLen) out.push({ clip, local: clip.dur - 0.001, key: prefix + clip.id, under: true });
      }
    }
  }
  // Draw outgoing (under) clips before the incoming one on the same track
  return out.sort((a, b) => (b.under ? 1 : 0) - (a.under ? 1 : 0));
}

// ── Building a layer element once ────────────────────────────────────
function makeLayer(clip) {
  const el = document.createElement("div");
  el.className = `layer layer-${clip.kind}`;
  el.dataset.clip = clip.id;
  if (clip.kind === "video") {
    if (clip.name.startsWith("beach")) el.append(beachTpl.content.cloneNode(true));
    else el.innerHTML = '<div class="vid-fill"></div><div class="vid-grain"></div>';
  } else if (clip.kind === "sticker") {
    el.innerHTML = '<svg viewBox="0 0 64 64"><use href="#seal-mark" /></svg>';
  } else if (clip.kind === "image") {
    el.innerHTML = '<div class="logo-art"><svg viewBox="0 0 64 64"><use href="#seal-mark" /></svg><span>Cloudy<br />Studio</span></div>';
  } else if (clip.kind === "text") {
    el.innerHTML = "<span></span>";
  } else if (clip.kind === "comp") {
    el.innerHTML = '<div class="comp-inner"></div>';
  }
  return el;
}

// ── Animation presets: returns extra transform/opacity for in/out ────
function animState(clip, local) {
  const d = pv(clip, "animDur");
  let k = 1;
  let name = "None";
  if (local < d && pv(clip, "animIn") !== "None") (name = pv(clip, "animIn")), (k = local / d);
  else if (clip.dur - local < d && pv(clip, "animOut") !== "None") (name = pv(clip, "animOut")), (k = (clip.dur - local) / d);
  const e = 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
  switch (name) {
    case "Fade": return { opacity: e, ty: 0, s: 1, r: 0 };
    case "Slide up": return { opacity: e, ty: (1 - e) * 6, s: 1, r: 0 };
    case "Zoom": return { opacity: e, ty: 0, s: 0.4 + 0.6 * e, r: 0 };
    case "Pop": return { opacity: Math.min(1, k * 3), ty: 0, s: k < 0.6 ? 0.5 + (k / 0.6) * 0.65 : 1.15 - ((k - 0.6) / 0.4) * 0.15, r: 0 };
    case "Spin": return { opacity: e, ty: 0, s: e, r: (1 - e) * -180 };
    default: return { opacity: 1, ty: 0, s: 1, r: 0 };
  }
}

function styleLayer(el, clip, local, under) {
  const a = animState(clip, local);
  const scale = (pv(clip, "scale") / 100) * a.s;
  const fx = (pv(clip, "flipH") ? -1 : 1) * scale;
  const fy = (pv(clip, "flipV") ? -1 : 1) * scale;
  el.style.transform =
    `translate(-50%, -50%) translate(${(pv(clip, "x") / FRAME_W) * 100}cqw, ${(pv(clip, "y") / FRAME_H) * 100 + a.ty}cqh) ` +
    `rotate(${pv(clip, "rot") + a.r}deg) scale(${fx}, ${fy})`;

  let opacity = (pv(clip, "opacity") / 100) * a.opacity;
  if (clip.trans && !under) opacity *= Math.min(1, local / Math.min(0.6, clip.dur / 2));
  el.style.opacity = opacity;
  el.style.mixBlendMode = { Normal: "normal", Add: "plus-lighter" }[pv(clip, "blend")] ?? pv(clip, "blend").toLowerCase();

  const filters = [];
  if (clip.fx) filters.push("saturate(1.5) contrast(1.08)");
  if (pv(clip, "bright")) filters.push(`brightness(${1 + pv(clip, "bright") / 100})`);
  if (pv(clip, "contrast")) filters.push(`contrast(${1 + pv(clip, "contrast") / 100})`);
  if (pv(clip, "sat")) filters.push(`saturate(${1 + pv(clip, "sat") / 100})`);
  if (pv(clip, "temp")) filters.push(`sepia(${Math.max(0, pv(clip, "temp")) / 200}) hue-rotate(${Math.min(0, pv(clip, "temp")) / 4}deg)`);
  el.style.filter = filters.join(" ");

  if (clip.kind === "video" && clip.colors && !clip.name.startsWith("beach")) {
    el.style.setProperty("--a", clip.colors[0]);
    el.style.setProperty("--b", clip.colors[1]);
    el.style.setProperty("--drift", `${(local * 8) % 100}%`);
  }
  if (clip.kind === "text") {
    const span = el.firstChild;
    const text = overrides[clip.id]?.text ?? clip.props?.text ?? clip.name;
    if (span.textContent !== text) span.textContent = text;
    el.style.fontSize = `${(pv(clip, "size") / FRAME_W) * 100}cqw`;
    el.style.fontFamily = pv(clip, "font") === "Inter" ? "" : `"${pv(clip, "font")}", var(--font-sans)`;
    el.style.fontWeight = { Regular: 400, Medium: 500, Bold: 700, Black: 900 }[pv(clip, "weight")];
    el.style.textAlign = pv(clip, "align");
    const tint = (color, percent) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;
    const cqw = (px) => `${(px / FRAME_W) * 100}cqw`;
    el.style.color = tint(pv(clip, "color"), pv(clip, "fillOpacity"));
    el.style.fontStyle = pv(clip, "italic") ? "italic" : "";
    el.style.textTransform = pv(clip, "upper") ? "uppercase" : "";
    el.style.letterSpacing = cqw(pv(clip, "letters"));
    el.style.lineHeight = pv(clip, "lines");
    el.classList.toggle("has-stroke", pv(clip, "stroke"));
    el.classList.toggle("has-highlight", pv(clip, "highlight"));
    el.classList.toggle("has-shadow", pv(clip, "shadow"));
    span.style.webkitTextStroke = pv(clip, "stroke") ? `${cqw(pv(clip, "strokeWidth"))} ${pv(clip, "strokeColor")}` : "";
    const boxed = pv(clip, "highlight");
    span.style.background = boxed ? tint(pv(clip, "bgColor"), pv(clip, "bgOpacity")) : "";
    span.style.padding = boxed ? cqw(pv(clip, "bgPad")) : "";
    span.style.borderRadius = boxed ? cqw(pv(clip, "bgRadius")) : "";
    const angle = (pv(clip, "shadowAngle") * Math.PI) / 180;
    const dist = pv(clip, "shadowDist");
    el.style.textShadow = pv(clip, "shadow")
      ? `${cqw(Math.cos(angle) * dist)} ${cqw(Math.sin(angle) * dist)} ${cqw(pv(clip, "shadowBlur"))} ${tint(pv(clip, "shadowColor"), pv(clip, "shadowOpacity"))}`
      : "";
  }
}

// ── Per frame ────────────────────────────────────────────────────────
/** Draws one sequence into `container`; nested compositions draw into their own layer. */
function drawSeq(s, t, container, prefix, seen) {
  const ordered = [];
  for (const { clip, local, key, under } of visibleAt(s, t, prefix)) {
    seen.add(key);
    let el = layerEls.get(key);
    if (!el || el.dataset.kind !== clip.kind || el.dataset.src !== clip.name) {
      el?.remove();
      el = makeLayer(clip);
      el.dataset.kind = clip.kind;
      el.dataset.src = clip.name;
      layerEls.set(key, el);
    }
    ordered.push(el);
    styleLayer(el, clip, local, under);
    if (clip.kind === "comp" && doc.seqs[clip.comp]) {
      drawSeq(doc.seqs[clip.comp], local, el.querySelector(".comp-inner"), `${key}/`, seen);
    }
  }
  // Re-append only when the stacking order changed
  const current = [...container.children].filter((c) => c.classList.contains("layer"));
  if (current.length !== ordered.length || current.some((c, i) => c !== ordered[i])) {
    for (const el of ordered) container.append(el);
  }
}

function frame_() {
  const seen = new Set();
  drawSeq(seq(), time, layersEl, "", seen);
  for (const [key, el] of layerEls) {
    if (!seen.has(key)) {
      el.remove();
      layerEls.delete(key);
    }
  }
  updateSelBox();
  requestAnimationFrame(frame_);
}

// ── Selection box on the canvas ──────────────────────────────────────
function selectedLayer() {
  const ids = primarySelection();
  if (ids.length !== 1) return null;
  const [id] = ids;
  const el = layerEls.get(id);
  return el?.isConnected && !el.classList.contains("layer-audio") ? { id, el } : null;
}

function updateSelBox() {
  const sel = selectedLayer();
  selBox.hidden = !sel;
  if (!sel) return;
  const { clip } = findClip(sel.id);
  const scale = pv(clip, "scale") / 100;
  selBox.style.width = `${sel.el.offsetWidth * scale}px`;
  selBox.style.height = `${sel.el.offsetHeight * scale}px`;
  selBox.style.transform =
    `translate(-50%, -50%) translate(${(pv(clip, "x") / FRAME_W) * 100}cqw, ${(pv(clip, "y") / FRAME_H) * 100}cqh) rotate(${pv(clip, "rot")}deg)`;
}

// Click a layer to select its clip; drag to move; handles scale / rotate
const frameEl = document.getElementById("frame");
frameEl.addEventListener("pointerdown", (e) => {
  const handle = e.target.closest("[data-h]");
  const layer = e.target.closest(".layer");
  const inBox = e.target.closest(".sel-box");
  let id;
  if (handle || inBox) id = primarySelection()[0];
  else if (layer) {
    // Topmost clip under the pointer that is in the current sequence
    id = layer.closest(".layers > .layer")?.dataset.clip;
    if (id && !view.selected.has(id)) {
      view.selected = new Set([id]);
      render();
    }
  } else {
    if (view.selected.size) (view.selected.clear(), render());
    return;
  }
  if (!id || !findClip(id)) return;
  e.preventDefault();

  const { clip } = findClip(id);
  const rect = frameEl.getBoundingClientRect();
  const unit = FRAME_W / rect.width;
  const cx = rect.left + rect.width / 2 + (prop(clip, "x") / unit);
  const cy = rect.top + rect.height / 2 + (prop(clip, "y") / unit);
  const x0 = e.clientX;
  const y0 = e.clientY;
  const start = { x: prop(clip, "x"), y: prop(clip, "y"), scale: prop(clip, "scale"), rot: prop(clip, "rot") };
  const d0 = Math.hypot(x0 - cx, y0 - cy) || 1;
  const a0 = Math.atan2(y0 - cy, x0 - cx);
  const mode = handle?.dataset.h ?? "move";
  const o = (overrides[id] ??= {});
  let moved = false;

  const move = (ev) => {
    moved = true;
    if (mode === "move") {
      let nx = Math.round(start.x + (ev.clientX - x0) * unit);
      let ny = Math.round(start.y + (ev.clientY - y0) * unit);
      // Snap to the center lines
      frameEl.classList.toggle("snap-x", Math.abs(nx) < 24);
      frameEl.classList.toggle("snap-y", Math.abs(ny) < 24);
      if (Math.abs(nx) < 24) nx = 0;
      if (Math.abs(ny) < 24) ny = 0;
      o.x = nx;
      o.y = ny;
    } else if (mode === "scale") {
      o.scale = Math.max(5, Math.round(start.scale * (Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0)));
    } else {
      let r = start.rot + ((Math.atan2(ev.clientY - cy, ev.clientX - cx) - a0) * 180) / Math.PI;
      if (ev.shiftKey) r = Math.round(r / 15) * 15;
      o.rot = Math.round(((r + 540) % 360) - 180);
    }
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    frameEl.classList.remove("snap-x", "snap-y");
    if (!moved) return;
    const changes = { ...o };
    run(mode === "move" ? "Move in preview" : mode === "scale" ? "Scale in preview" : "Rotate in preview", () => {
      const c = findClip(id).clip;
      c.props = { ...c.props, ...changes };
    });
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});

requestAnimationFrame(frame_);
