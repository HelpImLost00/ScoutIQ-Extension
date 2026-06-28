chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith("http")) return;

  const { sq_pill_on } = await chrome.storage.local.get("sq_pill_on");
  const next = !sq_pill_on;
  console.log("[ScoutIQ] toggling:", sq_pill_on, "→", next);
  await chrome.storage.local.set({ sq_pill_on: next });

  // Step 1: Ensure content.js is loaded (IIFE guard prevents double-init)
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (err) {
    console.log("[ScoutIQ] content.js inject:", err?.message);
  }

  // Step 2: Call __sq_toggle directly — this always works whether the script
  // was freshly injected in step 1 or was already running from the manifest.
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (on) => {
        if (window.__sq_toggle) await window.__sq_toggle(on);
        else console.warn("[ScoutIQ] __sq_toggle not set yet");
      },
      args: [next],
    });
  } catch (err) {
    console.log("[ScoutIQ] toggle call failed:", err?.message);
  }
});
