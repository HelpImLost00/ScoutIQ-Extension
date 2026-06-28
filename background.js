// Extension icon click → toggle the pill on the active page
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith("http")) return;

  const send = () => chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PILL" });

  try {
    await send();
  } catch {
    // Content script not yet running on this page — inject it, then toggle
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      // Give the script a moment to register its message listener
      await new Promise(r => setTimeout(r, 150));
      await send();
    } catch (err) {
      console.warn("ScoutIQ: could not toggle pill", err);
    }
  }
});
