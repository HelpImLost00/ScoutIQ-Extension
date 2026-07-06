// Minimal diagnostic: does the click reach the service worker and can we inject?
chrome.action.onClicked.addListener(async (tab) => {
  console.log("[SQ] clicked tab", tab?.id, tab?.url?.slice(0, 80));

  if (!tab?.id || !tab?.url?.startsWith("http")) {
    console.warn("[SQ] skipping non-http tab");
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const existing = document.getElementById("__sq_diag__");
        if (existing) { existing.remove(); return; }
        const d = document.createElement("div");
        d.id = "__sq_diag__";
        d.style.cssText = [
          "position:fixed", "bottom:24px", "right:24px",
          "z-index:2147483647", "background:#7c3aed", "color:#fff",
          "padding:14px 20px", "border-radius:14px",
          "font:700 14px/1 -apple-system,sans-serif",
          "box-shadow:0 4px 24px rgba(124,58,237,.5)",
          "cursor:pointer"
        ].join(";");
        d.textContent = "⚡ ScoutIQ — click worked!";
        d.onclick = () => d.remove();
        document.body.appendChild(d);
        console.log("[SQ content] diagnostic pill injected ✓");
      }
    });
    console.log("[SQ] executeScript succeeded");
  } catch (err) {
    console.error("[SQ] executeScript FAILED:", err?.message);
  }
});
