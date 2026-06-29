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
        b.style.cssText = "position:fixed;top:44px;left:0;right:0;z-index:2147483648;background:orange;color:#000;padding:8px;font:bold 13px monospace;text-align:center;white-space:pre-wrap;";
        b.textContent = "ScoutIQ inject error: " + msg;
        document.body.appendChild(b); setTimeout(() => b.remove(), 10000);
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
        const parsed = !!window.__sq_parsed;
        const iifeRan = !!window.__sq_iife_ran;
        const hasToggle = typeof window.__sq_toggle === "function";
        const status = "parsed:" + parsed + " iife:" + iifeRan + " toggle:" + hasToggle;
        if (!hasToggle) {
          const b = document.createElement("div");
          b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#c00;color:#fff;padding:8px;font:bold 13px sans-serif;text-align:center;";
          b.textContent = "ScoutIQ: " + status;
          document.body.appendChild(b); setTimeout(() => b.remove(), 10000);
          return;
        }
        try { await window.__sq_toggle(on); }
        catch(e) {
          const b = document.createElement("div");
          b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#c00;color:#fff;padding:8px;font:bold 13px sans-serif;text-align:center;";
          b.textContent = "ScoutIQ toggle threw: " + e.message;
          document.body.appendChild(b); setTimeout(() => b.remove(), 10000);
          return;
        }
        const host = document.getElementById("__scoutiq__");
        const apply = !!window.__sq_apply_called;
        const step = window.__sq_inject_step || "never";
        const err = window.__sq_inject_error || "";
        const ok = !!host;
        const b = document.createElement("div");
        b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:" + (ok ? "#1a7a1a" : "#c00") + ";color:#fff;padding:8px;font:bold 12px monospace;text-align:center;white-space:pre-wrap;";
        b.textContent = status + " apply:" + apply + " step:" + step + " host:" + ok + (err ? "\nerr:" + err : "");
        document.body.appendChild(b); setTimeout(() => b.remove(), 15000);
      },
      args: [next],
    });
  } catch (err) {
    console.log("[ScoutIQ] toggle call failed:", err?.message);
  }
});
