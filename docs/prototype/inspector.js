// Cloudy Clip prototype: the inspector. Shows the project when nothing is selected, the clip's
// properties when one is, and shared actions for several. Laid out like DaVinci Resolve: a strip of
// icon tabs, then a list of sections with a switch, keyframe and reset. Edits commit through `run()`
// on release. Sections tagged "Soon" are mock only: the app doesn't have them yet.

const insp = document.getElementById("inspector");
const inspView = { tab: {}, collapsed: new Set(["composite", "anim", "speed", "color"]) };

const DEFAULTS = {
  x: 0, y: 0, scale: 100, rot: 0, opacity: 100, blend: "Normal", flipH: false, flipV: false, fit: "Fit",
  bright: 0, contrast: 0, sat: 0, temp: 0,
  volume: 0, fadeIn: 0, fadeOut: 0, pan: 0, enhance: false,
  speed: 1, keepPitch: true, reverse: false, speedMode: "Normal",
  animIn: "None", animOut: "None", animLoop: "None", animDur: 0.5,
  font: "Inter", size: 64, weight: "Bold", italic: false, upper: false, align: "center", letters: 0, lines: 1.2,
  color: "#ffffff", fillOpacity: 100,
  stroke: false, strokeColor: "#000000", strokeWidth: 8,
  highlight: false, bgColor: "#f2a385", bgOpacity: 100, bgPad: 16, bgRadius: 0,
  shadow: true, shadowColor: "#000000", shadowOpacity: 40, shadowBlur: 24, shadowDist: 6, shadowAngle: 90,
  variation: "Original", transDur: 0.6,
  on_transform: true, on_composite: true, on_color: true, on_anim: true,
};
const prop = (clip, key) => clip.props?.[key] ?? DEFAULTS[key];

const RESET_KEYS = {
  transform: ["x", "y", "scale", "rot"],
  composite: ["fit", "opacity", "blend", "flipH", "flipV"],
  color: ["bright", "contrast", "sat", "temp"],
  anim: ["animIn", "animOut", "animLoop", "animDur"],
  volume: ["volume", "fadeIn", "fadeOut", "pan", "enhance"],
  speed: ["speed", "keepPitch", "reverse", "speedMode"],
  font: ["font", "size", "weight", "italic", "upper", "align", "letters", "lines"],
  fill: ["color", "fillOpacity"],
  outline: ["strokeColor", "strokeWidth"],
  background: ["bgColor", "bgOpacity", "bgPad", "bgRadius"],
  shadowfx: ["shadowColor", "shadowOpacity", "shadowBlur", "shadowDist", "shadowAngle"],
  transition: ["transDur"],
};

/** A section switched off draws as if its values were the defaults. */
function isBypassed(clip, key) {
  return ["transform", "composite", "color", "anim"].some((id) => !prop(clip, `on_${id}`) && RESET_KEYS[id].includes(key));
}

const VISUAL = new Set(["video", "image", "comp", "text", "sticker"]);
const SOUND = new Set(["video", "comp", "audio", "music"]);
const KIND_NAME = { video: "Video", image: "Image", comp: "Composition", sticker: "Sticker", text: "Text", audio: "Audio", music: "Music" };

/** Every clip sees the same strip; what doesn't apply is greyed out, so tabs never jump around. */
function tabsOf(clip) {
  return [
    ...(clip.kind === "text" ? [{ id: "Text", icon: "text", on: true }] : []),
    ...(clip.kind === "sticker" ? [{ id: "Sticker", icon: "sticker", on: true }] : []),
    { id: "Video", label: clip.kind === "image" ? "Image" : "Video", icon: "video", on: VISUAL.has(clip.kind) },
    { id: "Audio", icon: "music", on: SOUND.has(clip.kind) },
    { id: "Effects", icon: "fx", on: Boolean(clip.fx), why: "No effects on this clip" },
    { id: "Transition", icon: "trans", on: Boolean(clip.trans), why: "No transition on this clip's cuts" },
    { id: "File", icon: "file", on: true },
  ];
}

/** Commits one property change as an undoable command. */
function setProp(id, key, value) {
  const found = findClip(id);
  if (!found || prop(found.clip, key) === value) return;
  run(`Set ${key}`, () => {
    const c = findClip(id).clip;
    if (key === "speed") {
      // Duration at 1× speed, so changing speed again stays exact
      c.baseDur ??= c.dur * prop(c, "speed");
      c.dur = c.baseDur / value;
    }
    c.props = { ...c.props, [key]: value };
    if (key === "speed") packMain();
    if (key === "text") c.name = value;
  });
}

function hasKeyAt(clip) {
  const local = time - clip.start;
  return (clip.keys ?? []).some((k) => Math.abs(k - local) < 0.05);
}

function toggleKey(id) {
  const { clip } = findClip(id);
  const local = time - clip.start;
  if (local < 0 || local > clip.dur) return toast("Move the playhead over this clip to add a keyframe");
  run(hasKeyAt(clip) ? "Remove keyframe" : "Add keyframe", () => {
    const c = findClip(id).clip;
    const keys = c.keys ?? [];
    const i = keys.findIndex((k) => Math.abs(k - local) < 0.05);
    c.keys = i >= 0 ? keys.filter((_, j) => j !== i) : [...keys, local].sort((a, b) => a - b);
  });
}

// ── Field builders ───────────────────────────────────────────────────
const RESET_ICON = '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" /></svg>';

const kfBtn = (clip) =>
  `<button class="kf-btn pro-only ${hasKeyAt(clip) ? "is-on" : ""}" data-kf title="Keyframe at playhead"><i></i></button>`;

/** The end of a row: keyframe diamond, and a reset arrow that lights up once the value changed. */
function rowEnd(clip, keys, kf = true) {
  const changed = keys.some((k) => prop(clip, k) !== DEFAULTS[k]);
  return `${kf ? kfBtn(clip) : '<span class="kf-space pro-only"></span>'}
    <button class="f-reset" ${changed ? "" : "disabled"} data-reset-prop="${keys.join(",")}" title="Reset">${RESET_ICON}</button>`;
}

const num = (clip, key, label, unit, step = 1) =>
  `<label class="f-num"><span class="f-scrub" data-scrub="${key}" data-step="${step}" title="Drag to change">${label}</span>
    <input type="number" data-prop="${key}" value="${prop(clip, key)}" step="${step}" /><span class="f-unit">${unit}</span></label>`;

const pair = (clip, label, a, b, unit) =>
  `<div class="f-row"><span class="f-name">${label}</span><div class="f-pair">${num(clip, a[0], a[1], unit)}${num(clip, b[0], b[1], unit)}</div>${rowEnd(clip, [a[0], b[0]])}</div>`;

function slider(clip, key, label, min, max, step, unit, kf = true) {
  const v = prop(clip, key);
  return `<div class="f-row"><span class="f-name">${label}</span>
    <input class="f-range" type="range" data-prop="${key}" min="${min}" max="${max}" step="${step}" value="${v}" />
    <label class="f-box"><input type="number" data-prop="${key}" data-out="${key}" min="${min}" max="${max}" step="${step}" value="${v}" /><span>${unit.trim()}</span></label>
    ${rowEnd(clip, [key], kf)}</div>`;
}

function seg(clip, key, label, options, cls = "") {
  const v = prop(clip, key);
  return `<div class="f-row ${cls}"><span class="f-name">${label}</span><div class="segmented f-seg">${options
    .map((o) => `<button data-prop="${key}" data-value="${o}" class="${String(v) === String(o) ? "is-active" : ""}">${o}</button>`)
    .join("")}</div>${rowEnd(clip, [key], false)}</div>`;
}

function toggle(clip, key, label, hint = "", cls = "") {
  return `<label class="f-row f-toggle ${cls}"><span class="f-name">${label}${hint ? `<small>${hint}</small>` : ""}</span>
    <input type="checkbox" data-prop="${key}" ${prop(clip, key) ? "checked" : ""} /><span class="switch"></span></label>`;
}

function select(clip, key, label, options, cls = "") {
  const v = prop(clip, key);
  return `<div class="f-row ${cls}"><span class="f-name">${label}</span><select class="f-select" data-prop="${key}">${options
    .map((o) => `<option ${o === v ? "selected" : ""}>${o}</option>`)
    .join("")}</select>${rowEnd(clip, [key], false)}</div>`;
}

function colorField(clip, key, label) {
  const v = prop(clip, key);
  return `<div class="f-row"><span class="f-name">${label}</span>
    <label class="f-color"><i style="background:${v}"></i><input type="color" data-prop="${key}" value="${v}" /><span class="mono">${v.toUpperCase()}</span></label>
    ${rowEnd(clip, [key])}</div>`;
}

/** A band with a switch on the left, the title, then keyframe and reset. Off hides the body. */
function section(id, title, body, { clip, pro = false, reset = true, sw, kf = false, soon = false } = {}) {
  const closed = inspView.collapsed.has(id);
  const off = sw !== undefined && !prop(clip, sw);
  return `<section class="i-sec ${pro ? "pro-only" : ""} ${closed ? "is-closed" : ""} ${off ? "is-off" : ""}" data-sec="${id}">
    <header class="i-sec-head">
      <span class="i-sec-sw">${sw === undefined ? "" : `<label class="f-toggle" title="Turn ${title.toLowerCase()} on or off"><input type="checkbox" data-prop="${sw}" ${off ? "" : "checked"} /><span class="switch"></span></label>`}</span>
      <button class="i-sec-toggle" data-collapse="${id}">${title}</button>
      ${soon ? '<span class="i-soon" title="Mock only: not in the app yet">Soon</span>' : ""}
      ${kf ? kfBtn(clip) : ""}
      ${reset ? `<button class="f-reset i-reset" data-reset="${id}" title="Reset ${title.toLowerCase()}">${RESET_ICON}</button>` : ""}
    </header>
    <div class="i-sec-body">${body}</div></section>`;
}

// ── Tabs content ─────────────────────────────────────────────────────
function animSection(clip) {
  const presets = ["None", "Fade", "Slide up", "Zoom", "Pop", "Spin"];
  const key = `anim${inspView.anim ?? "In"}`;
  const body = `
    <div class="anim-tabs">${["In", "Out", "Loop"].map((t) => `<button class="${(inspView.anim ?? "In") === t ? "is-active" : ""}" data-anim-tab="${t}">${t}</button>`).join("")}</div>
    <div class="anim-grid">${presets
      .map((p) => `<button class="anim-tile ${prop(clip, key) === p ? "is-active" : ""}" data-prop="${key}" data-value="${p}"><span class="anim-demo anim-${p.replace(" ", "-").toLowerCase()}"></span>${p}</button>`)
      .join("")}</div>
    ${slider(clip, "animDur", "Duration", 0.1, 3, 0.1, "s", false)}`;
  return section("anim", "Animation", body, { clip, sw: "on_anim", soon: true });
}

function speedSection(clip) {
  const body = `
    ${seg(clip, "speedMode", "Mode", ["Normal", "Curve"])}
    ${slider(clip, "speed", "Speed", 0.1, 10, 0.1, "×", false)}
    <div class="f-row"><span class="f-name">Duration</span><span class="mono">${clip.dur.toFixed(2)}s</span></div>
    ${toggle(clip, "keepPitch", "Keep pitch", "Voices don't sound chipmunk")}
    ${toggle(clip, "reverse", "Reverse", "", "pro-only")}`;
  return section("speed", "Speed Change", body, { clip, soon: true });
}

function videoTab(clip) {
  const transform = `
    ${pair(clip, "Position", ["x", "X"], ["y", "Y"], "px")}
    ${slider(clip, "scale", "Scale", 10, 400, 1, "%")}
    ${slider(clip, "rot", "Rotation", -180, 180, 1, "°")}`;
  const composite = `
    ${seg(clip, "fit", "Fit", ["Fit", "Fill", "Stretch"])}
    ${slider(clip, "opacity", "Opacity", 0, 100, 1, "%")}
    ${select(clip, "blend", "Blend", ["Normal", "Multiply", "Screen", "Overlay", "Add", "Darken", "Lighten"])}
    <div class="f-row"><span class="f-name">Flip</span><div class="f-btns">
      <button class="f-btn ${prop(clip, "flipH") ? "is-on" : ""}" data-flip="flipH" title="Flip horizontal"><svg viewBox="0 0 24 24"><path d="M12 3v18M8 7 3 12l5 5zM16 7l5 5-5 5z" /></svg></button>
      <button class="f-btn ${prop(clip, "flipV") ? "is-on" : ""}" data-flip="flipV" title="Flip vertical"><svg viewBox="0 0 24 24"><path d="M3 12h18M7 8l5-5 5 5zM7 16l5 5 5-5z" /></svg></button>
    </div></div>`;
  const color = `
    ${slider(clip, "bright", "Brightness", -100, 100, 1, "")}
    ${slider(clip, "contrast", "Contrast", -100, 100, 1, "")}
    ${slider(clip, "sat", "Saturation", -100, 100, 1, "")}
    ${slider(clip, "temp", "Temperature", -100, 100, 1, "")}`;
  return (
    section("transform", "Transform", transform, { clip, sw: "on_transform", kf: true }) +
    section("composite", "Composite", composite, { clip, sw: "on_composite", soon: true }) +
    animSection(clip) +
    (clip.kind === "video" || clip.kind === "comp" ? speedSection(clip) : "") +
    section("color", "Color", color, { clip, sw: "on_color", pro: true, soon: true })
  );
}

function textTab(clip) {
  const content = `<textarea class="f-text" data-prop="text" rows="3">${clip.props?.text ?? clip.name}</textarea>
    <div class="preset-row">${["Title", "Highlight", "Outline", "Pop!"].map((p) => `<button class="preset" data-preset="${p}">${p}</button>`).join("")}</div>`;
  const font = `
    ${select(clip, "font", "Font", ["Inter", "JetBrains Mono", "Georgia", "Impact", "Comic Neue"])}
    <div class="f-row"><span class="f-name">Style</span>
      <select class="f-select" data-prop="weight">${["Regular", "Medium", "Bold", "Black"].map((o) => `<option ${o === prop(clip, "weight") ? "selected" : ""}>${o}</option>`).join("")}</select>
      <button class="f-btn f-letter ${prop(clip, "italic") ? "is-on" : ""}" data-flip="italic" title="Italic"><i>I</i></button>
      <button class="f-btn f-letter ${prop(clip, "upper") ? "is-on" : ""}" data-flip="upper" title="Uppercase">TT</button>
      ${rowEnd(clip, ["weight", "italic", "upper"], false)}</div>
    ${slider(clip, "size", "Size", 8, 400, 1, "px")}
    ${seg(clip, "align", "Align", ["left", "center", "right"])}
    ${slider(clip, "letters", "Letters", -20, 100, 0.5, "px")}
    ${slider(clip, "lines", "Lines", 0.8, 2.5, 0.05, "×")}`;
  const fill = `${colorField(clip, "color", "Color")}${slider(clip, "fillOpacity", "Opacity", 0, 100, 1, "%")}`;
  const outline = `${colorField(clip, "strokeColor", "Color")}${slider(clip, "strokeWidth", "Width", 0, 100, 0.5, "px")}`;
  const background = `
    ${colorField(clip, "bgColor", "Color")}
    ${slider(clip, "bgOpacity", "Opacity", 0, 100, 1, "%")}
    ${slider(clip, "bgPad", "Padding", 0, 300, 1, "px")}
    ${slider(clip, "bgRadius", "Radius", 0, 300, 1, "px")}`;
  const shadow = `
    ${colorField(clip, "shadowColor", "Color")}
    ${slider(clip, "shadowOpacity", "Opacity", 0, 100, 1, "%")}
    ${slider(clip, "shadowBlur", "Blur", 0, 100, 0.5, "px")}
    ${slider(clip, "shadowDist", "Distance", 0, 100, 0.5, "px")}
    ${slider(clip, "shadowAngle", "Angle", 0, 360, 1, "°")}`;
  return (
    section("content", "Content", content, { clip, reset: false }) +
    section("font", "Font", font, { clip }) +
    section("fill", "Fill", fill, { clip }) +
    section("outline", "Outline", outline, { clip, sw: "stroke" }) +
    section("background", "Background", background, { clip, sw: "highlight" }) +
    section("shadowfx", "Shadow", shadow, { clip, sw: "shadow" })
  );
}

function stickerTab(clip) {
  return section("variation", "Variations", seg(clip, "variation", "Color", ["Original", "Ice", "Blush"]), { clip, reset: false });
}

function audioTab(clip) {
  const track = findClip(clip.id).track;
  const body = `
    ${slider(clip, "volume", "Volume", -40, 12, 0.5, " dB")}
    ${slider(clip, "fadeIn", "Fade in", 0, 5, 0.1, "s", false)}
    ${slider(clip, "fadeOut", "Fade out", 0, 5, 0.1, "s", false)}
    ${slider(clip, "pan", "Pan", -100, 100, 1, "").replace('class="f-row"', 'class="f-row pro-only"')}
    ${toggle(clip, "enhance", "Enhance voice", "Removes noise and echo")}`;
  const rows = [
    ["Track", track.id],
    ...(clip.link ? [["Linked to", findClip(clip.link)?.clip.name ?? "—"]] : []),
  ];
  return (
    section("volume", "Volume", body, { clip, soon: true }) +
    (clip.kind === "audio" || clip.kind === "music" ? speedSection(clip) : "") +
    section("sound", "Sound", `<dl class="info">${rows.map(([k, v]) => `<dt>${k}</dt><dd class="mono">${v}</dd>`).join("")}</dl>`, { clip, reset: false })
  );
}

function effectsTab() {
  const body = `<div class="fx-row"><span class="fx-sw"></span><span class="fx-name">Vivid</span><span class="mono muted">80%</span>
      <button class="icon-btn" data-fx-remove title="Remove effect"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button></div>
    <button class="link-btn" data-goto="effects">+ Add effect</button>`;
  return section("effects", "Effects", body, { reset: false, soon: true });
}

function transitionTab(clip) {
  const presets = ["Fade", "Dissolve", "Cross dissolve", "Left to right", "Glare", "Glitch", "Woosh"];
  const body = `
    <div class="f-row"><span class="f-name">Preset</span><select class="f-select" data-trans>${[clip.trans, ...presets.filter((p) => p !== clip.trans)]
      .map((o) => `<option>${o}</option>`).join("")}</select></div>
    ${slider(clip, "transDur", "Duration", 0.1, 3, 0.1, "s", false)}
    <div class="i-actions"><button class="btn btn-sm btn-danger" data-trans-remove>Remove transition</button></div>`;
  return section("transition", "Transition", body, { clip });
}

function fileTab(clip) {
  const list = (rows) => `<dl class="info">${rows.map(([k, v]) => `<dt>${k}</dt><dd class="mono">${v}</dd>`).join("")}</dl>`;
  const hasFile = ["video", "image", "audio", "music"].includes(clip.kind);
  const timing = [
    ["Start", formatTimecode(clip.start)],
    ["End", formatTimecode(clip.start + clip.dur)],
    ["Duration", formatTimecode(clip.dur)],
    ...(clip.kind === "video" || clip.kind === "audio" || clip.kind === "music" ? [["Source in", formatTimecode(0)]] : []),
  ];
  const info = [
    ["Track", findClip(clip.id).track.id],
    ...(hasFile ? [["File", clip.name]] : []),
    ...(clip.kind === "video" ? [["Codec", "H.264 · 1080×1920 · 30 fps"], ["Proxy", "Not needed"]] : []),
    ...(clip.comp ? [["Contains", `${allClips(doc.seqs[clip.comp] ?? { tracks: [] }).length} clips`]] : []),
  ];
  return section("timing", "Timing", list(timing), { reset: false }) + section("info", "Info", list(info), { reset: false });
}

// ── Views ────────────────────────────────────────────────────────────
function clipView(clip) {
  const tabs = tabsOf(clip);
  const saved = tabs.find((t) => t.id === inspView.tab[clip.kind] && t.on);
  const tab = (saved ?? tabs.find((t) => t.on)).id;
  const body = { Video: videoTab, Text: textTab, Sticker: stickerTab, Audio: audioTab, Effects: effectsTab, Transition: transitionTab, File: fileTab }[tab](clip);
  return `
    <header class="i-head">
      <span class="i-kind i-kind-${clip.kind}">${svg(clip.kind)}</span>
      <div class="i-title"><b>${clip.name}</b><span class="muted">${KIND_NAME[clip.kind]} · ${clip.dur.toFixed(1)}s${clip.group ? " · grouped" : ""}</span></div>
      ${clip.kind === "comp" ? `<button class="btn btn-sm i-open" data-open-comp="${clip.comp}">Open</button>` : ""}
    </header>
    <nav class="i-tabs">${tabs
      .map((t) => `<button data-itab="${t.id}" class="${t.id === tab ? "is-active" : ""}" ${t.on ? "" : `disabled title="${t.why ?? `${clip.kind} clips have no ${t.id.toLowerCase()}`}"`}>${svg(t.icon)}<span>${t.label ?? t.id}</span></button>`)
      .join("")}</nav>
    <div class="i-scroll" data-clip-id="${clip.id}">${body}</div>`;
}

function multiView(ids) {
  const clips = ids.map((id) => findClip(id)?.clip).filter(Boolean);
  return `
    <header class="i-head"><span class="i-kind">${svg("group")}</span>
      <div class="i-title"><b>${clips.length} clips selected</b><span class="muted">Changes apply to all of them</span></div></header>
    <div class="i-scroll">
      <ul class="i-list">${clips.map((c) => `<li>${svg(c.kind)}<span>${c.name}</span></li>`).join("")}</ul>
      <div class="i-actions">
        <button class="btn btn-sm" data-act="group">Group / ungroup</button>
        <button class="btn btn-sm pro-only" data-act="comp">Make composition</button>
        <button class="btn btn-sm btn-danger" data-act="delete">Delete</button>
      </div>
    </div>`;
}

function projectView() {
  const aspect = document.getElementById("frame").dataset.aspect;
  return `
    <header class="i-head"><span class="i-kind i-kind-project"><svg viewBox="0 0 64 64"><use href="#seal-mark" /></svg></span>
      <div class="i-title"><b>Summer reel</b><span class="muted">Project · nothing selected</span></div></header>
    <div class="i-scroll">
      ${section("canvas", "Canvas", `
        <div class="f-row"><span class="f-name">Format</span><div class="segmented f-seg">${["9:16", "4:5", "1:1", "16:9"]
          .map((a) => `<button data-aspect-set="${a}" class="${a === aspect ? "is-active" : ""}">${a}</button>`).join("")}</div></div>
        <div class="f-row"><span class="f-name">Resolution</span><select class="f-select"><option>1080 × 1920</option><option>720 × 1280</option><option>2160 × 3840</option></select></div>
        <div class="f-row"><span class="f-name">Frame rate</span><select class="f-select"><option>30 fps</option><option>24 fps</option><option>25 fps</option><option>60 fps</option></select></div>
        <div class="f-row"><span class="f-name">Background</span><div class="swatches">
          <button class="swatch-btn is-active" style="--c:#000" title="Black"></button>
          <button class="swatch-btn swatch-blur" title="Blurred video"></button>
          <button class="swatch-btn" style="--c:#fff" title="White"></button>
          <button class="swatch-btn" style="--c:var(--ice-300)" title="Ice"></button></div></div>`, { reset: false })}
      ${section("agents", "Agents", `
        <p class="i-note">Agents like Claude can edit this project with you, live. Anything they change shows up here and can be undone.</p>
        <div class="code-row"><code class="mono">claude mcp add --transport http cloudy-clip http://127.0.0.1:7420/mcp</code>
          <button class="icon-btn" data-copy title="Copy"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" /><path d="M16 8V4H4v12h4" /></svg></button></div>
        <div class="f-row"><span class="f-name">MCP server</span><span class="status-dot">Running · port 7420</span></div>`, { reset: false })}
      <div class="tip">
        <svg class="tip-seal" viewBox="0 0 64 64"><use href="#seal-mark" /></svg>
        <p><b>Tip</b> Select a clip to edit it here. Press <kbd>S</kbd> to split at the playhead, <kbd>?</kbd> for all shortcuts.</p>
      </div>
    </div>`;
}

function renderInspector() {
  const ids = primarySelection();
  const scrollTop = insp.querySelector(".i-scroll")?.scrollTop ?? 0;
  if (!ids.length) insp.innerHTML = projectView();
  else if (ids.length === 1 && findClip(ids[0])) insp.innerHTML = clipView(findClip(ids[0]).clip);
  else insp.innerHTML = multiView(ids);
  const sc = insp.querySelector(".i-scroll");
  if (sc) sc.scrollTop = scrollTop;
}

window.addEventListener("timeline:selection", () => {
  // Don't rebuild while the user is typing in a field
  if (insp.contains(document.activeElement) && document.activeElement.matches("input[type=number], textarea")) return;
  renderInspector();
});

// ── Events ───────────────────────────────────────────────────────────
const selectedId = () => insp.querySelector("[data-clip-id]")?.dataset.clipId;
const parse = (el) => (el.type === "checkbox" ? el.checked : el.type === "number" || el.type === "range" ? Number(el.value) : el.value);

// Live feedback while dragging a slider; commit on release
insp.addEventListener("input", (e) => {
  const el = e.target;
  if (el.type === "range") {
    const out = insp.querySelector(`[data-out="${el.dataset.prop}"]`);
    if (out) out.value = el.value;
    window.dispatchEvent(new CustomEvent("inspector:preview", { detail: { id: selectedId(), key: el.dataset.prop, value: Number(el.value) } }));
  }
});

insp.addEventListener("change", (e) => {
  const el = e.target;
  const id = selectedId();
  if (el.matches("[data-trans]")) return run("Set transition", () => (findClip(id).clip.trans = el.value));
  if (!el.dataset.prop || !id) return;
  setProp(id, el.dataset.prop, parse(el));
});

insp.addEventListener("click", (e) => {
  const t = e.target;
  const id = selectedId();
  const btn = (sel) => t.closest(sel);

  if (btn("[data-itab]")) {
    const { clip } = findClip(id);
    inspView.tab[clip.kind] = btn("[data-itab]").dataset.itab;
    return renderInspector();
  }
  if (btn("[data-collapse]")) {
    const sec = btn("[data-collapse]").dataset.collapse;
    inspView.collapsed.has(sec) ? inspView.collapsed.delete(sec) : inspView.collapsed.add(sec);
    return renderInspector();
  }
  if (btn("[data-anim-tab]")) {
    inspView.anim = btn("[data-anim-tab]").dataset.animTab;
    return renderInspector();
  }
  if (btn("button[data-prop][data-value]")) {
    const b = btn("button[data-prop][data-value]");
    const v = b.dataset.value;
    return setProp(id, b.dataset.prop, isNaN(Number(v)) || v === "" ? v : Number(v));
  }
  if (btn("[data-flip]")) {
    const key = btn("[data-flip]").dataset.flip;
    return setProp(id, key, !prop(findClip(id).clip, key));
  }
  if (btn("[data-kf]")) return toggleKey(id);
  if (btn("[data-reset-prop]")) {
    const keys = btn("[data-reset-prop]").dataset.resetProp.split(",");
    return run("Reset", () => {
      const c = findClip(id).clip;
      const props = { ...c.props };
      for (const k of keys) delete props[k];
      if (keys.includes("speed") && c.baseDur) (c.dur = c.baseDur), packMain();
      c.props = props;
    });
  }
  if (btn("[data-trans-remove]")) return run("Remove transition", () => (findClip(id).clip.trans = undefined));
  if (btn("[data-reset]")) {
    const keys = RESET_KEYS[btn("[data-reset]").dataset.reset] ?? [];
    return run("Reset", () => {
      const c = findClip(id).clip;
      const props = { ...c.props };
      for (const k of keys) delete props[k];
      if (keys.includes("speed") && c.baseDur) (c.dur = c.baseDur), packMain();
      c.props = props;
    });
  }
  if (btn("[data-preset]")) {
    const p = btn("[data-preset]").dataset.preset;
    const looks = {
      Title: { size: 96, weight: "Black", stroke: false, highlight: false, color: "#ffffff" },
      Highlight: { size: 56, weight: "Bold", highlight: true, color: "#1f2430" },
      Outline: { size: 72, weight: "Black", stroke: true, highlight: false, color: "#ffffff" },
      "Pop!": { size: 80, weight: "Black", color: "#8cc4f0", animIn: "Pop" },
    }[p];
    return run(`Text style ${p}`, () => {
      const c = findClip(id).clip;
      c.props = { ...c.props, ...looks };
    });
  }
  if (btn("[data-fx-remove]")) return run("Remove effect", () => (findClip(id).clip.fx = false));
  if (btn("[data-goto]")) return document.querySelector(`.rail-tab[data-tab="${btn("[data-goto]").dataset.goto}"]`).click();
  if (btn("[data-open-comp]")) return openComp(btn("[data-open-comp]").dataset.openComp);
  if (btn("[data-act]")) {
    const act = btn("[data-act]").dataset.act;
    return act === "group" ? toggleGroup() : act === "comp" ? makeComposition() : deleteSelected();
  }
  if (btn("[data-aspect-set]")) {
    document.querySelector(`#aspect [data-aspect="${btn("[data-aspect-set]").dataset.aspectSet}"]`).click();
    return renderInspector();
  }
  if (btn("[data-copy]")) {
    navigator.clipboard?.writeText(insp.querySelector(".code-row code").textContent).catch(() => {});
    return toast("Command copied");
  }
  if (btn("[data-soon]")) return toast("Coming later");
});

// Scrubbable labels: drag "X" or "Y" left/right to change the number (like Premiere / AE)
insp.addEventListener("pointerdown", (e) => {
  const label = e.target.closest("[data-scrub]");
  if (!label) return;
  e.preventDefault();
  const input = label.parentElement.querySelector("input");
  const step = Number(label.dataset.step);
  const start = Number(input.value);
  const x0 = e.clientX;
  document.body.classList.add("is-resizing-col");
  const move = (ev) => {
    input.value = Math.round(start + (ev.clientX - x0) * step);
    window.dispatchEvent(new CustomEvent("inspector:preview", { detail: { id: selectedId(), key: label.dataset.scrub, value: Number(input.value) } }));
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    document.body.classList.remove("is-resizing-col");
    setProp(selectedId(), label.dataset.scrub, Number(input.value));
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});

renderInspector();
