// Cloudy Clip prototype: collaborators in the top bar. An agent connected over MCP shows up like a
// person in a shared doc: presence, what it is doing, and controls to pause, limit or follow it.

const avatarBtn = document.getElementById("agent-avatar");
const pop = document.getElementById("collab-pop");
const statusEl = document.getElementById("cp-agent-status");
const followEl = document.getElementById("cp-follow");
window.agentAccess = "edit";

avatarBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  pop.hidden = !pop.hidden;
});
window.addEventListener("pointerdown", (e) => {
  if (!pop.hidden && !pop.contains(e.target) && !avatarBtn.contains(e.target)) pop.hidden = true;
});

function setAgentState(state, text) {
  avatarBtn.dataset.state = state;
  for (const a of document.querySelectorAll(".avatar-agent")) a.dataset.state = state;
  const access = window.agentAccess === "view" ? " · view only" : "";
  statusEl.textContent =
    state === "editing" ? `Editing · ${text}` : state === "off" ? "Disconnected" : `Agent · connected via MCP · idle${access}`;
  avatarBtn.title = state === "off" ? "Claude Code · disconnected" : state === "editing" ? `Claude Code · ${text}` : "Claude Code · connected via MCP";
}

window.addEventListener("agent:status", (e) => {
  const { running, text, t } = e.detail;
  setAgentState(running ? "editing" : window.agentAccess === "off" ? "off" : "idle", text);
  // Follow: keep the agent's cursor in view on the timeline
  if (running && followEl.checked && t != null) {
    const x = headW() + t * view.pps;
    const left = scroll.scrollLeft + headW();
    const right = scroll.scrollLeft + scroll.clientWidth - 40;
    if (x < left || x > right) scroll.scrollTo({ left: Math.max(0, x - scroll.clientWidth / 2), behavior: "smooth" });
  }
});

document.getElementById("cp-access").addEventListener("click", (e) => {
  const b = e.target.closest("[data-access]");
  if (!b) return;
  for (const x of e.currentTarget.children) x.classList.toggle("is-active", x === b);
  window.agentAccess = b.dataset.access;
  if (window.agentAccess === "view" && agent.running) stopAgent();
  setAgentState("idle");
  toast(window.agentAccess === "view" ? "Claude Code can now only read the project" : "Claude Code can edit again");
});

document.getElementById("cp-pause").addEventListener("click", () => {
  if (agent.running) {
    stopAgent();
    toast("Agent paused · its changes so far are kept (Ctrl+Z to undo)");
  } else toast("The agent isn't doing anything right now");
});

const disconnectBtn = document.getElementById("cp-disconnect");
disconnectBtn.addEventListener("click", () => {
  const off = window.agentAccess !== "off";
  if (off) stopAgent();
  window.agentAccess = off ? "off" : "edit";
  disconnectBtn.textContent = off ? "Reconnect" : "Disconnect";
  setAgentState(off ? "off" : "idle");
});

setAgentState("idle");
