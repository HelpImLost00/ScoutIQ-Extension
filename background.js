chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith("http")) return;

  // Flip the pill state in storage — content scripts that ARE running will
  // react via their chrome.storage.onChanged listener immediately.
  const { sq_pill_on } = await chrome.storage.local.get("sq_pill_on");
  const next = !sq_pill_on;
  console.log("[ScoutIQ] icon clicked — toggling pill:", sq_pill_on, "→", next);
  await chrome.storage.local.set({ sq_pill_on: next });

  // Also inject content.js for tabs that were open before the extension loaded.
  // The IIFE guard at the top of content.js (window.__sq_loaded) makes this
  // a no-op if the script is already running, so there's no double-injection.
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch {
    // Page doesn't allow injection (chrome:// etc) — storage change alone is enough
  }
});
