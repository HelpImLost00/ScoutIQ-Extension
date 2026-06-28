chrome.action.onClicked.addListener(async () => {
  const { sq_pill_on } = await chrome.storage.local.get("sq_pill_on");
  const next = !sq_pill_on;
  console.log("[ScoutIQ] icon clicked — toggling pill:", sq_pill_on, "→", next);
  await chrome.storage.local.set({ sq_pill_on: next });
});
