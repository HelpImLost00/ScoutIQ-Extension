// Extension icon click → toggle the pill on the active page
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith("http")) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PILL" });
  } catch {
    // Content script not yet injected on this page — inject it then toggle
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PILL" });
    } catch {}
  }
});
