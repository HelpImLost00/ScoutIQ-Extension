chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith("http")) return;

  try {
    // Check if the content script is already running (window.__sq_toggle exists)
    const [{ result: ready }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => typeof window.__sq_toggle === "function",
    });

    if (!ready) {
      // Content script not running yet — inject it then wait for it to initialize
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      await new Promise(r => setTimeout(r, 200));
    }

    // Call the toggle function directly in the isolated world
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__sq_toggle?.(),
    });
  } catch (err) {
    console.warn("ScoutIQ: toggle failed", err);
  }
});
