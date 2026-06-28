chrome.action.onClicked.addListener(async (tab) => {
  console.log("[ScoutIQ] clicked — tab:", tab?.id, tab?.url);
  if (!tab.id || !tab.url?.startsWith("http")) {
    console.log("[ScoutIQ] skipping — not an http tab");
    return;
  }

  const { sq_pill_on } = await chrome.storage.local.get("sq_pill_on");
  const next = !sq_pill_on;
  console.log("[ScoutIQ] toggling:", sq_pill_on, "→", next);
  await chrome.storage.local.set({ sq_pill_on: next });

  // Minimal direct test — does executeScript reach the page at all?
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (on) => {
        console.log("[ScoutIQ] func reached page — on:", on);
        const ID = "__sq_direct__";
        let el = document.getElementById(ID);
        if (on) {
          if (!el) {
            el = document.createElement("div");
            el.id = ID;
            el.style.cssText = [
              "position:fixed", "bottom:24px", "right:24px",
              "z-index:2147483647", "background:#6c47ff", "color:#fff",
              "padding:10px 18px", "border-radius:999px", "font:600 14px/1 sans-serif",
              "cursor:pointer", "box-shadow:0 4px 20px rgba(0,0,0,.4)",
            ].join(";");
            el.textContent = "⚡ ScoutIQ";
            document.body.appendChild(el);
          }
          el.style.display = "";
        } else {
          if (el) el.style.display = "none";
        }
        return "ok";
      },
      args: [next],
    });
    console.log("[ScoutIQ] executeScript result:", results);
  } catch (err) {
    console.error("[ScoutIQ] executeScript failed:", err);
  }
});
