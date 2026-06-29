chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith("http")) return;

  // Inject (or re-inject) content.js
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (err) {
    console.warn("[ScoutIQ] content.js inject failed:", err?.message);
    return;
  }

  // Toggle based on actual DOM state, not persisted storage
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        if (!window.__sq_toggle) return;
        const isOn = !!document.getElementById("__scoutiq__");
        await window.__sq_toggle(!isOn);
      },
    });
  } catch (err) {
    console.warn("[ScoutIQ] toggle failed:", err?.message);
  }
});
