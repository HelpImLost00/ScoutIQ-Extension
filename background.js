chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith("http")) return;

  const { sq_pill_on } = await chrome.storage.local.get("sq_pill_on");
  const next = !sq_pill_on;
  console.log("[ScoutIQ] icon clicked — toggling pill:", sq_pill_on, "→", next);
  await chrome.storage.local.set({ sq_pill_on: next });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    console.log("[ScoutIQ] executeScript succeeded");
  } catch (err) {
    console.log("[ScoutIQ] executeScript skipped/failed:", err?.message);
  }
});
