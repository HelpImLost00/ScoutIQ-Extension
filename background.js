// ── Purple badge when pill is active ─────────────────────────────────────────
function setBadge(tabId, active) {
  chrome.action.setBadgeBackgroundColor({ color: "#7c3aed" });
  chrome.action.setBadgeText({ text: active ? "●" : "", tabId });
}

// ── Icon click: toggle pill ────────────────────────────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id || !tab?.url?.startsWith("http")) return;

  // Try messaging the already-running content script first
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "sq_toggle" });
    if (res?.ok) return;
  } catch {}

  // Fall back: inject both files then call toggle
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["gsap.min.js"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => { if (window.__sq_toggle) window.__sq_toggle(true); },
    });
  } catch (err) {
    console.error("[SQ bg] inject failed:", err?.message);
  }
});

// ── Listen for pill state from content script ─────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "sq_pill_state" && sender.tab?.id != null) {
    setBadge(sender.tab.id, msg.active);
  }
});

// ── Reset badge on navigation ─────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") setBadge(tabId, false);
});
