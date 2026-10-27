// Cloudy Clip prototype: export dialog, shortcuts sheet and the first-run welcome.

function openModal(id) {
  document.getElementById(id).hidden = false;
}
function closeModals() {
  for (const m of document.querySelectorAll(".modal")) m.hidden = true;
}
for (const m of document.querySelectorAll(".modal")) {
  m.addEventListener("click", (e) => {
    if (e.target === m || e.target.closest("[data-close-modal]")) closeModals();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModals();
  if (e.key === "?" && !e.target.closest("input, textarea")) openModal("keys-modal");
});
document.getElementById("shortcuts-btn").addEventListener("click", () => openModal("keys-modal"));

// ── Export ───────────────────────────────────────────────────────────
const ex = {
  res: document.getElementById("ex-res"),
  fps: document.getElementById("ex-fps"),
  quality: document.getElementById("ex-quality"),
  format: document.getElementById("ex-format"),
  bitrate: document.getElementById("ex-bitrate"),
};
const segValue = (el) => Number(el.querySelector(".is-active")?.dataset.v ?? 1);

function estimate() {
  const [w, h] = ex.res.value.split("x").map(Number);
  const dur = seqDuration(doc.seqs.main);
  const fmt = ex.format.value;
  let mbps = ((w * h) / (1080 * 1920)) * 12 * (segValue(ex.fps) / 30) * segValue(ex.quality);
  if (view.mode === "pro") mbps = Number(ex.bitrate.value);
  if (fmt.includes("265")) mbps *= 0.6;
  if (fmt.includes("ProRes")) mbps = 147 * ((w * h) / (1920 * 1080));
  if (fmt.includes("GIF")) mbps = 30;
  if (fmt.includes("MP3")) mbps = 0.32;
  const mb = (mbps * dur) / 8;
  document.getElementById("ex-size").textContent = mb > 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
  document.getElementById("ex-dur").textContent = formatTimecode(dur).slice(3);
}

for (const group of [ex.fps, ex.quality, ...document.querySelectorAll("#export-settings .ex-advanced .segmented")]) {
  group.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    for (const x of group.children) x.classList.toggle("is-active", x === b);
    markCustom();
    estimate();
  });
}
for (const el of [ex.res, ex.format]) el.addEventListener("change", () => (markCustom(), estimate()));
ex.bitrate.addEventListener("input", () => {
  document.getElementById("ex-bitrate-out").textContent = `${ex.bitrate.value} Mb/s`;
  estimate();
});

const presets = document.getElementById("ex-presets");
function markCustom() {
  const active = presets.querySelector(".is-active");
  const fps = String(segValue(ex.fps));
  if (active?.dataset.res !== ex.res.value || active?.dataset.fps !== fps) {
    for (const p of presets.children) p.classList.toggle("is-active", p.dataset.res === "custom");
  }
}
presets.addEventListener("click", (e) => {
  const p = e.target.closest(".ex-preset");
  if (!p) return;
  for (const x of presets.children) x.classList.toggle("is-active", x === p);
  if (p.dataset.res !== "custom") {
    ex.res.value = p.dataset.res;
    for (const b of ex.fps.children) b.classList.toggle("is-active", b.dataset.v === p.dataset.fps);
  }
  estimate();
});

const exViews = {
  settings: document.getElementById("export-settings"),
  progress: document.getElementById("export-progress"),
  done: document.getElementById("export-done"),
};
const exFoot = document.getElementById("export-foot");
let exTimer = 0;

function showExportView(name) {
  for (const [k, el] of Object.entries(exViews)) el.hidden = k !== name;
  exFoot.innerHTML =
    name === "settings"
      ? '<span class="muted ex-foot-note">Exports from your original files, at full quality.</span><button class="btn" data-close-modal>Cancel</button><button class="btn btn-primary" id="export-start">Export</button>'
      : name === "progress"
        ? '<span class="muted ex-foot-note">Rendering with FFmpeg</span><button class="btn" id="export-cancel">Cancel export</button><button class="btn" data-close-modal>Keep editing</button>'
        : '<button class="btn" id="export-again">Export another</button><span class="ex-foot-note"></span><button class="btn">Show in folder</button><button class="btn btn-primary" data-close-modal>Done</button>';
}

document.getElementById("export-btn").addEventListener("click", () => {
  if (exViews.progress.hidden) showExportView(exViews.done.hidden ? "settings" : "done");
  estimate();
  openModal("export-modal");
});

exFoot.addEventListener("click", (e) => {
  if (e.target.closest("#export-start")) startExport();
  if (e.target.closest("#export-cancel")) {
    clearInterval(exTimer);
    showExportView("settings");
    toast("Export cancelled");
  }
  if (e.target.closest("#export-again")) showExportView("settings");
});

function startExport() {
  showExportView("progress");
  const fill = document.getElementById("ex-fill");
  const seal = document.getElementById("ex-seal");
  const pct = document.getElementById("ex-pct");
  const eta = document.getElementById("ex-eta");
  const exportBtn = document.getElementById("export-btn");
  let p = 0;
  clearInterval(exTimer);
  exTimer = setInterval(() => {
    p = Math.min(100, p + 1.2 + Math.random() * 2.5);
    fill.style.width = `${p}%`;
    seal.style.left = `${p}%`;
    pct.textContent = `${Math.floor(p)}%`;
    eta.textContent = p < 100 ? `About ${Math.ceil((100 - p) / 6)}s left · frame ${Math.floor((p / 100) * 450)} of 450` : "Finishing…";
    exportBtn.style.setProperty("--progress", `${p}%`);
    exportBtn.classList.add("is-exporting");
    if (p >= 100) {
      clearInterval(exTimer);
      exportBtn.classList.remove("is-exporting");
      showExportView("done");
      if (document.getElementById("export-modal").hidden) toast("Export finished · Summer reel.mp4");
    }
  }, 120);
}

// ── First run ────────────────────────────────────────────────────────
const WELCOME_KEY = "cloudy-clip-prototype:welcomed";
const welcome = document.getElementById("welcome");
document.querySelector(".preview").append(welcome); // sits in the preview's corner, clear of the frame
try {
  welcome.hidden = localStorage.getItem(WELCOME_KEY) === "1";
} catch {
  welcome.hidden = false;
}
document.getElementById("welcome-close").addEventListener("click", () => {
  welcome.hidden = true;
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    // shown again next time
  }
});
