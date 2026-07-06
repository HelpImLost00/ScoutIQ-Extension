// ── Purple badge when pill is active ─────────────────────────────────────────
function setBadge(tabId, active) {
  chrome.action.setBadgeBackgroundColor({ color: "#7c3aed" });
  chrome.action.setBadgeText({ text: active ? "●" : "", tabId });
}

chrome.action.onClicked.addListener(async (tab) => {
  console.log("[SQ bg] clicked", tab?.id, tab?.url?.slice(0, 60));
  if (!tab?.id || !tab?.url?.startsWith("http")) return;

  try {
    // Step 1: inject gsap
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["gsap.min.js"] });
    console.log("[SQ bg] gsap injected");

    // Step 2: inject content.js
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    console.log("[SQ bg] content.js injected");

    // Step 3: check what's available, then call toggle
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const info = {
          toggleType: typeof window.__sq_toggle,
          injected: window.__sq_toggle_registered,
          pillInDom: !!document.getElementById("__scoutiq__"),
        };
        console.log("[SQ content] state before toggle:", JSON.stringify(info));
        if (!window.__sq_toggle) return { ...info, error: "no __sq_toggle" };
        try {
          window.__sq_toggle(true);
          return { ...info, called: true };
        } catch (e) {
          return { ...info, error: e.message };
        }
      }
    });
    console.log("[SQ bg] toggle result:", JSON.stringify(res?.[0]?.result));
  } catch (err) {
    console.error("[SQ bg] FAILED:", err?.message);
  }
});

// Listen for pill state from content script
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "sq_pill_state" && sender.tab?.id != null) {
    setBadge(sender.tab.id, msg.active);
  }
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") setBadge(tabId, false);
});
