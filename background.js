// ── Purple badge when pill is active ─────────────────────────────────────────
function setBadge(tabId, active) {
  chrome.action.setBadgeBackgroundColor({ color: "#7c3aed" });
  chrome.action.setBadgeText({ text: active ? "●" : "", tabId });
}

// ── Icon click: toggle pill ────────────────────────────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  console.log("[SQ bg] icon clicked, tab:", tab?.id, tab?.url?.slice(0, 60));
  if (!tab.id || !tab.url?.startsWith("http")) {
    console.warn("[SQ bg] skipping — not an http tab");
    return;
  }

  // 1. Try messaging the already-running content script
  try {
    console.log("[SQ bg] sending sq_toggle message…");
    const res = await chrome.tabs.sendMessage(tab.id, { type: "sq_toggle" });
    console.log("[SQ bg] message response:", res);
    if (res?.ok) return;
  } catch (e) {
    console.log("[SQ bg] sendMessage failed (will inject):", e?.message);
  }

  // 2. Content script not alive — inject both files, then call toggle
  console.log("[SQ bg] injecting gsap + content.js…");
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["gsap.min.js", "content.js"],
    });
    console.log("[SQ bg] injection done, calling __sq_toggle(true)…");
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        console.log("[SQ content] executeScript toggle called, __sq_toggle:", typeof window.__sq_toggle);
        if (window.__sq_toggle) window.__sq_toggle(true);
      },
    });
  } catch (err) {
    console.error("[SQ bg] inject failed:", err?.message);
  }
});

// ── Listen for pill state from content script ─────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "sq_pill_state" && sender.tab?.id != null) {
    console.log("[SQ bg] pill state update → tab", sender.tab.id, "active:", msg.active);
    setBadge(sender.tab.id, msg.active);
  }
});

// ── Reset badge on navigation ─────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") {
    setBadge(tabId, false);
  }
});
