chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith("http")) return;

  const { sq_pill_on } = await chrome.storage.local.get("sq_pill_on");
  const next = !sq_pill_on;
  console.log("[ScoutIQ] toggling:", sq_pill_on, "→", next);
  await chrome.storage.local.set({ sq_pill_on: next });

  // Step 1: Ensure content.js is loaded
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (err) {
    // Show inject error visibly on the page
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (msg) => {
        const b = document.createElement("div");
        b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:orange;color:#000;padding:8px;font:bold 13px monospace;text-align:center;white-space:pre-wrap;";
        b.textContent = "ScoutIQ files inject error: " + msg;
        document.body.appendChild(b);
      },
      args: [String(err)],
    }).catch(() => {});
  }

  // Step 2: Call __sq_toggle directly — this always works whether the script
  // was freshly injected in step 1 or was already running from the manifest.
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (on) => {
        if (!window.__sq_toggle) {
          // surface missing-toggle as a visible banner
          const b = document.createElement("div");
          b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#c00;color:#fff;padding:8px;font:bold 13px sans-serif;text-align:center;";
          b.textContent = "ScoutIQ: __sq_toggle missing (content.js did not initialize)";
          document.body.appendChild(b); setTimeout(() => b.remove(), 8000);
          return;
        }
        try { await window.__sq_toggle(on); }
        catch(e) {
          const b = document.createElement("div");
          b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#c00;color:#fff;padding:8px;font:bold 13px sans-serif;text-align:center;";
          b.textContent = "ScoutIQ toggle error: " + e.message;
          document.body.appendChild(b); setTimeout(() => b.remove(), 8000);
          return;
        }
        // Show DOM state so we know if inject() ran
        const host = document.getElementById("__scoutiq__");
        const hasShadow = !!(host && host.shadowRoot);
        const b = document.createElement("div");
        b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:" + (hasShadow ? "#1a7a1a" : "#c00") + ";color:#fff;padding:8px;font:bold 13px sans-serif;text-align:center;";
        b.textContent = "ScoutIQ debug — host:" + !!host + " shadow:" + hasShadow + " on:" + on;
        document.body.appendChild(b); setTimeout(() => b.remove(), 8000);
      },
      args: [next],
    });
  } catch (err) {
    console.log("[ScoutIQ] toggle call failed:", err?.message);
  }
});
