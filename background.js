// Extension icon click → toggle sq_pill_on in storage.
// Content scripts listen for the storage change and show/hide the pill themselves.
// No message passing, no script injection needed.
chrome.action.onClicked.addListener(async () => {
  const { sq_pill_on } = await chrome.storage.local.get("sq_pill_on");
  await chrome.storage.local.set({ sq_pill_on: !sq_pill_on });
});
