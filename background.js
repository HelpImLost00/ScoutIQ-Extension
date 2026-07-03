// ── Icon drawing (OffscreenCanvas — available in MV3 service workers) ─────────
function drawIcon(size, active) {
  const c = new OffscreenCanvas(size, size);
  const ctx = c.getContext("2d");
  const s = size;

  // Circle background
  ctx.fillStyle = active ? "#7c3aed" : "#4b5563";
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  ctx.fill();

  // Lightning bolt path
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(s * 0.60, s * 0.07);
  ctx.lineTo(s * 0.33, s * 0.50);
  ctx.lineTo(s * 0.50, s * 0.50);
  ctx.lineTo(s * 0.37, s * 0.93);
  ctx.lineTo(s * 0.68, s * 0.46);
  ctx.lineTo(s * 0.51, s * 0.46);
  ctx.lineTo(s * 0.66, s * 0.07);
  ctx.closePath();
  ctx.fill();

  return ctx.getImageData(0, 0, s, s);
}

function setTabIcon(tabId, active) {
  const opts = { imageData: { 16: drawIcon(16, active), 32: drawIcon(32, active) } };
  if (tabId != null) opts.tabId = tabId;
  chrome.action.setIcon(opts).catch(() => {});
}

// ── Per-tab pill state ─────────────────────────────────────────────────────────
const tabPillState = new Map();

function updateIcon(tabId, active) {
  tabPillState.set(tabId, active);
  setTabIcon(tabId, active);
}

// ── Icon click: toggle pill ────────────────────────────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith("http")) return;

  // Prefer messaging the already-running content script
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "sq_toggle" });
    if (res?.ok) return;
  } catch {}

  // Content script not yet running — inject both files, then turn on
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["gsap.min.js", "content.js"] });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => { if (window.__sq_toggle) window.__sq_toggle(true); },
    });
  } catch (err) {
    console.warn("[ScoutIQ] inject failed:", err?.message);
  }
});

// ── Listen for pill state changes from content script ─────────────────────────
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "sq_pill_state" && sender.tab?.id != null) {
    updateIcon(sender.tab.id, msg.active);
  }
});

// ── Reset icon on navigation ───────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") {
    tabPillState.delete(tabId);
    setTabIcon(tabId, false);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabPillState.delete(tabId);
});
